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

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;
const FRAMEWORK_FOLDERS = new Set(['routes', 'pages', 'app']);
const GENERATED_FILE_PATTERN = /\.gen\.[cm]?[jt]sx?$/;
const DECLARATION_FILE_PATTERN = /\.d\.[cm]?ts$/;

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

const { root, write, skips } = parseArguments(process.argv.slice(2));
const files = gitFiles(root);
const tracked = new Set(gitFiles(root, ['--cached']));
const renames = planRenames(files, skips);
const conflicts = findConflicts(renames, files);

for (const [from, to] of renames) {
  console.log(`${from} -> ${to}`);
}

for (const file of files.filter(
  (candidate) => hasUpperCaseStem(candidate) && !renames.has(candidate),
)) {
  console.log(`skipped: ${file}`);
}

if (conflicts.length > 0) {
  for (const conflict of conflicts) {
    console.error(`conflict: ${conflict}`);
  }

  console.error('Nothing renamed. Resolve the conflicts above, or --skip those files.');
  process.exit(1);
}

const rewrites = rewriteImports(files, renames, write);
console.log(`${renames.size} files, ${rewrites} import specifiers${write ? '' : ' (dry run)'}`);

if (write) {
  moveFiles(renames, tracked);
  reportLeftovers(renames);
}

/**
 * Reads the repo root and flags; exits with status 2 on anything it doesn't understand.
 */
function parseArguments(args) {
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const unknown = args.filter(
    (arg) => arg.startsWith('--') && arg !== '--write' && !arg.startsWith('--skip='),
  );

  if (positional.length !== 1 || unknown.length > 0) {
    console.error('Usage: node rename-kebab.mjs <repo-root> [--write] [--skip=<path-prefix>]...');
    process.exit(2);
  }

  return {
    root: path.resolve(positional[0]),
    write: args.includes('--write'),
    skips: args
      .filter((arg) => arg.startsWith('--skip='))
      .map((arg) => arg.slice('--skip='.length)),
  };
}

/**
 * Lists repo-relative paths that git tracks or would track (untracked but not ignored).
 */
function gitFiles(cwd, flags = ['--cached', '--others', '--exclude-standard']) {
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

    const [stem, ...suffixes] = path.posix.basename(file).split('.');
    const renamed = [kebabCase(stem), ...suffixes].join('.');
    planned.set(file, path.posix.join(path.posix.dirname(file), renamed));
  }

  return planned;
}

function isRenameCandidate(file, skipPrefixes) {
  if (!SOURCE_FILE_PATTERN.test(file) || GENERATED_FILE_PATTERN.test(file)) {
    return false;
  }

  if (
    DECLARATION_FILE_PATTERN.test(file) ||
    skipPrefixes.some((prefix) => file.startsWith(prefix))
  ) {
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
  const stem = path.posix.basename(file).split('.')[0];

  return SOURCE_FILE_PATTERN.test(file) && /[A-Z]/.test(stem) && !/^[_$]/.test(stem);
}

/**
 * `OrderSummary` → `order-summary`, `DNSDashboard` → `dns-dashboard`, `useAuth2` → `use-auth2`.
 */
function kebabCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/_/g, '-')
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
 * Rewrites every relative specifier that resolves to a renamed file, in every source file, and
 * returns how many it rewrote. Writes nothing unless `apply` is set.
 */
function rewriteImports(paths, planned, apply) {
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
  const [stem, ...suffixes] = specifier.slice(slash + 1).split('.');

  return specifier.slice(0, slash + 1) + [kebabCase(stem), ...suffixes].join('.');
}

function moveFiles(planned, trackedFiles) {
  for (const [from, to] of planned) {
    const temporary = path.posix.join(
      path.posix.dirname(from),
      `.rename-${path.posix.basename(to)}`,
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
function reportLeftovers(planned) {
  const patterns = [...planned.keys()].map((from) => {
    const name = path.posix.basename(from);
    const stem = name.split('.')[0];

    return new RegExp(`${escapeRegex(name)}|/${escapeRegex(stem)}(?=['"\`)/.\\s])`);
  });

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

  console.log(
    leftovers === 0
      ? 'No mentions of the old names remain.'
      : `${leftovers} leftover mentions to check.`,
  );
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
