#!/usr/bin/env node
/**
 * Rename PascalCase and camelCase source files to kebab-case, and rewrite the relative imports
 * that point at them.
 *
 * `OrderSummary.tsx` becomes `order-summary.tsx`, `useOrderSummary.test.ts` becomes
 * `use-order-summary.test.ts`, and `DNSDashboard.tsx` becomes `dns-dashboard.tsx`. Only the part
 * of the name before the first dot changes. Folders are never renamed, so a relative import only
 * needs its last segment rewritten, and only when it resolves to a renamed file.
 *
 * Tracked files move with `git mv`, so git records the rename even on a case-insensitive file
 * system (a plain `Pg.ts` to `pg.ts` rename there leaves git's index on the old name, and a Linux
 * checkout then fails to resolve `./pg.ts`). Untracked files move in two steps through a temporary
 * name for the same reason.
 *
 * Without --write the script only prints the plan. After writing, it lists every remaining
 * mention of an old file name (alias imports such as `#components/AppShell`, docs, configs) so you
 * can fix them by hand.
 *
 * Usage:
 *   node rename-kebab.mjs <repo-root> [--write] [--skip=<path-prefix>]...
 *
 *   --write               rename the files and rewrite imports (default: dry run)
 *   --skip=<path-prefix>  leave files under this repo-relative prefix alone; repeatable. Route
 *                         folders (`routes/`, `pages/`, `app/`) and generated `*.gen.*` files are
 *                         always skipped, because their names belong to the framework.
 *
 * Exit status: 0 on success, 1 when two files would get the same name or a target already
 * exists (nothing is renamed), 2 on usage errors.
 * No dependencies; requires Node 18 or later and git.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const USAGE = 'Usage: node rename-kebab.mjs <repo-root> [--write] [--skip=<path-prefix>]...';
const WRITE_FLAG = '--write';
const SKIP_FLAG = '--skip=';

const EXIT_CONFLICT = 1;
const EXIT_USAGE = 2;

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;
const FRAMEWORK_FOLDERS = new Set(['routes', 'pages', 'app']);
const GENERATED_FILE_PATTERN = /\.gen\.[cm]?[jt]sx?$/;
const DECLARATION_FILE_PATTERN = /\.d\.[cm]?ts$/;
const UPPER_CASE_LETTER = /[A-Z]/;

/**
 * Frameworks give special meaning to file names that start with `_` or `$` (`__root.tsx`,
 * `$orderId.tsx`), so those keep their case.
 */
const FRAMEWORK_NAME_PREFIX = /^[_$]/;

/**
 * The word boundaries in a file name: a capital after a lower-case letter or digit
 * (`orderSummary`), the last capital of an acronym before a word (`DNSDashboard`), and `_`.
 */
const LOWER_THEN_UPPER = /([a-z0-9])([A-Z])/g;
const ACRONYM_THEN_WORD = /([A-Z]+)([A-Z][a-z])/g;
const UNDERSCORE = /_/g;

/**
 * `git ls-files` options: every file git tracks or would track (untracked but not ignored), and
 * only the tracked ones, which are the files `git mv` can move.
 */
const TRACKED_OR_UNIGNORED = ['--cached', '--others', '--exclude-standard'];
const TRACKED = ['--cached'];

/**
 * Untracked files and `git mv` both go through this temporary name, so a case-only rename works
 * on a case-insensitive file system.
 */
const TEMPORARY_NAME_PREFIX = '.rename-';

/**
 * TypeScript lets `./order.js` name `order.ts`, so a `.js`-style specifier can point at any of
 * these source files.
 */
const EMITTED_TO_SOURCE = new Map([
  ['.js', ['.js', '.ts', '.tsx', '.jsx']],
  ['.jsx', ['.jsx', '.tsx']],
  ['.mjs', ['.mjs', '.mts']],
  ['.cjs', ['.cjs', '.cts']],
]);

/**
 * A quoted relative specifier, in an import, export, `import()`, `require()` or `vi.mock()`.
 */
const RELATIVE_SPECIFIER = /(['"])(\.{1,2}\/[^'"\n]*)\1/g;

const TEXT_FILE_PATTERN =
  /\.([cm]?[jt]sx?|json|jsonc|md|mdx|ya?ml|toml|html|css|scss|vue|svelte|astro)$/;
const LOCKFILE_PATTERN = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/;
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

main();

/**
 * Prints the rename plan, stops on conflicts, and with `--write` renames the files, rewrites the
 * imports and lists the mentions that are left. Sets the exit status described in the file header
 * through `process.exitCode`, so output piped to a slow reader is flushed before the process ends.
 */
function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (!parsed) {
    console.error(USAGE);
    process.exitCode = EXIT_USAGE;
    return;
  }

  const { root, write, skips } = parsed;
  const files = gitFiles(root);
  const tracked = new Set(gitFiles(root, TRACKED));
  const renames = planRenames(files, skips);
  const conflicts = findConflicts(renames, files);
  printPlan(renames, files);
  if (conflicts.length > 0) {
    printConflicts(conflicts);
    process.exitCode = EXIT_CONFLICT;
    return;
  }

  const rewrites = rewriteImports(root, files, renames, write);
  console.log(`${renames.size} files, ${rewrites} import specifiers${write ? '' : ' (dry run)'}`);

  if (write) {
    moveFiles(root, renames, tracked);
    reportLeftovers(root, renames);
  }
}

/**
 * Reads the repo root and flags. Returns null for anything it doesn't understand: no root, more
 * than one, or an unknown flag.
 */
function parseArguments(args) {
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const unknown = args.filter(
    (arg) => arg.startsWith('--') && arg !== WRITE_FLAG && !arg.startsWith(SKIP_FLAG),
  );
  if (positional.length !== 1 || unknown.length > 0) {
    return null;
  }

  return {
    root: path.resolve(positional[0]),
    write: args.includes(WRITE_FLAG),
    skips: args
      .filter((arg) => arg.startsWith(SKIP_FLAG))
      .map((arg) => arg.slice(SKIP_FLAG.length)),
  };
}

/**
 * Lists the repo-relative paths that git reports for `flags` and that exist on disk, without
 * duplicates. A file deleted but not yet staged is still listed by git, so the disk check drops it.
 */
function gitFiles(cwd, flags = TRACKED_OR_UNIGNORED) {
  const output = execFileSync('git', ['ls-files', ...flags], { cwd, encoding: 'utf8' });
  const listed = output.split('\n').filter(Boolean);
  return [...new Set(listed)].filter((file) => fs.existsSync(path.join(cwd, file)));
}

/**
 * Maps each source file whose name isn't kebab-case to its kebab-case path.
 */
function planRenames(paths, skipPrefixes) {
  const planned = new Map();

  for (const file of paths) {
    if (!isRenameCandidate(file, skipPrefixes)) {
      continue;
    }

    const renamed = kebabFileName(path.posix.basename(file));
    planned.set(file, path.posix.join(path.posix.dirname(file), renamed));
  }

  return planned;
}

/**
 * True for a source file with a capital in its name, unless a tool owns the name: generated and
 * declaration files, `--skip` prefixes, and files inside a framework's route folders.
 */
function isRenameCandidate(file, skipPrefixes) {
  const toolOwned = GENERATED_FILE_PATTERN.test(file) || DECLARATION_FILE_PATTERN.test(file);
  if (!SOURCE_FILE_PATTERN.test(file) || toolOwned) {
    return false;
  }

  if (skipPrefixes.some((prefix) => file.startsWith(prefix))) {
    return false;
  }

  const folders = path.posix.dirname(file).split('/');
  if (folders.some((folder) => FRAMEWORK_FOLDERS.has(folder))) {
    return false;
  }

  return hasUpperCaseStem(file);
}

/**
 * True for a source file whose name before the first dot has a capital letter, except
 * framework-owned names that start with `_` or `$` (`__root.tsx`, `$orderId.tsx`).
 */
function hasUpperCaseStem(file) {
  const stem = stemOf(path.posix.basename(file));
  return (
    SOURCE_FILE_PATTERN.test(file) &&
    UPPER_CASE_LETTER.test(stem) &&
    !FRAMEWORK_NAME_PREFIX.test(stem)
  );
}

/**
 * The part of a file name before the first dot: `AppShell` for `AppShell.test.tsx`.
 */
function stemOf(name) {
  return name.split('.')[0];
}

/**
 * Kebab-cases the stem of a file name and keeps its suffixes: `AppShell.test.tsx` becomes
 * `app-shell.test.tsx`, and `AppShell` (an extensionless specifier) becomes `app-shell`.
 */
function kebabFileName(name) {
  const [stem, ...suffixes] = name.split('.');
  return [kebabCase(stem), ...suffixes].join('.');
}

/**
 * `OrderSummary` → `order-summary`, `DNSDashboard` → `dns-dashboard`, `useAuth2` → `use-auth2`.
 */
function kebabCase(name) {
  return name
    .replace(LOWER_THEN_UPPER, '$1-$2')
    .replace(ACRONYM_THEN_WORD, '$1-$2')
    .replace(UNDERSCORE, '-')
    .toLowerCase();
}

/**
 * Finds targets that already exist or that two files would share. Comparisons ignore case,
 * because on macOS and Windows `Order.ts` and `order.ts` are the same file.
 */
function findConflicts(planned, paths) {
  const existing = new Map(paths.map((file) => [file.toLowerCase(), file]));
  const claimed = new Map();
  const found = [];

  for (const [from, to] of planned) {
    const key = to.toLowerCase();
    const owner = existing.get(key);
    if (owner !== undefined && owner !== from) {
      found.push(`${from} -> ${to}, but ${owner} already exists`);
    }

    if (claimed.has(key)) {
      found.push(`${from} and ${claimed.get(key)} would both become ${to}`);
    }

    claimed.set(key, from);
  }

  return found;
}

/**
 * Prints each planned rename, then each file that isn't kebab-case but stays as it is.
 */
function printPlan(planned, paths) {
  for (const [from, to] of planned) {
    console.log(`${from} -> ${to}`);
  }

  const skipped = paths.filter((file) => hasUpperCaseStem(file) && !planned.has(file));
  for (const file of skipped) {
    console.log(`skipped: ${file}`);
  }
}

function printConflicts(conflicts) {
  for (const conflict of conflicts) {
    console.error(`conflict: ${conflict}`);
  }

  console.error('Nothing renamed. Resolve the conflicts above, or --skip those files.');
}

/**
 * Rewrites every relative specifier that resolves to a renamed file, in every source file, and
 * returns how many it rewrote. Writes nothing unless `apply` is set.
 */
function rewriteImports(root, paths, planned, apply) {
  const known = new Set(paths);
  let count = 0;

  for (const file of paths.filter((candidate) => SOURCE_FILE_PATTERN.test(candidate))) {
    const absolute = path.join(root, file);
    const text = fs.readFileSync(absolute, 'utf8');
    const updated = text.replace(RELATIVE_SPECIFIER, (match, quote, specifier) => {
      const target = resolveSpecifier(file, specifier, known);
      if (target === undefined || !planned.has(target)) {
        return match;
      }

      count++;

      return `${quote}${renameLastSegment(specifier)}${quote}`;
    });
    if (apply && updated !== text) {
      fs.writeFileSync(absolute, updated);
    }
  }

  return count;
}

/**
 * Resolves a relative specifier the way TypeScript's bundler and NodeNext resolution would, to a
 * repo-relative file path, or `undefined` when it names a folder or nothing in the repo.
 */
function resolveSpecifier(importer, specifier, known) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  const extension = path.posix.extname(base);

  if (known.has(base)) {
    return base;
  }

  const stem = base.slice(0, base.length - extension.length);
  const sourceExtensions = EMITTED_TO_SOURCE.get(extension);
  if (sourceExtensions !== undefined) {
    return sourceExtensions
      .map((candidate) => stem + candidate)
      .find((candidate) => known.has(candidate));
  }

  return SOURCE_EXTENSIONS.map((candidate) => base + candidate).find((candidate) =>
    known.has(candidate),
  );
}

/**
 * Kebab-cases the stem of a specifier's last segment and keeps its suffixes, so `./AppShell`,
 * `./AppShell.js` and `./AppShell.test.tsx` keep the form they were written in.
 */
function renameLastSegment(specifier) {
  const slash = specifier.lastIndexOf('/');
  return specifier.slice(0, slash + 1) + kebabFileName(specifier.slice(slash + 1));
}

/**
 * Moves each file to its new name in two steps through a temporary name: with `git mv` when git
 * tracks it, so the index follows, and with a plain rename otherwise.
 */
function moveFiles(root, planned, trackedFiles) {
  for (const [from, to] of planned) {
    const temporary = path.posix.join(
      path.posix.dirname(from),
      `${TEMPORARY_NAME_PREFIX}${path.posix.basename(to)}`,
    );

    if (trackedFiles.has(from)) {
      execFileSync('git', ['mv', from, temporary], { cwd: root });
      execFileSync('git', ['mv', temporary, to], { cwd: root });

      continue;
    }

    fs.renameSync(path.join(root, from), path.join(root, temporary));
    fs.renameSync(path.join(root, temporary), path.join(root, to));
  }
}

/**
 * Prints every line that still mentions an old file name: an old base name with its extension
 * (`AppShell.tsx`), or an old stem at the end of a path (`components/AppShell'`). These are
 * alias imports, docs and configs that the relative-import rewrite can't resolve.
 */
function reportLeftovers(root, planned) {
  const patterns = [...planned.keys()].map(oldNamePattern);
  const textFiles = gitFiles(root).filter(
    (file) => TEXT_FILE_PATTERN.test(file) && !LOCKFILE_PATTERN.test(file),
  );

  let leftovers = 0;

  for (const file of textFiles) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        leftovers++;
        console.log(`leftover: ${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  if (leftovers === 0) {
    console.log('No mentions of the old names remain.');
    return;
  }

  console.log(`${leftovers} leftover mentions to check.`);
}

/**
 * Matches the old base name anywhere, or `/` and the old stem followed by a quote, backtick,
 * parenthesis, slash, dot or whitespace, which is where a path or specifier ends.
 */
function oldNamePattern(from) {
  const name = path.posix.basename(from);
  const stem = stemOf(name);
  return new RegExp(`${escapeRegex(name)}|/${escapeRegex(stem)}(?=['"\`)/.\\s])`);
}

function escapeRegex(text) {
  return text.replace(REGEX_SPECIAL_CHARACTERS, '\\$&');
}
