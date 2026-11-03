// Script and task checks: `npm run x`, `pnpm x`, `yarn workspace a x` and `turbo x` must name a
// script or task that exists, and `--filter` values must match a workspace package.

import path from 'node:path';

import { hasLocalBinary } from './project.mjs';

const MAX_LISTED_WORKSPACES = 8;

// Subcommands that pnpm, yarn and bun run themselves instead of looking up a script.
const PACKAGE_MANAGER_BUILTINS = new Set([
  'add',
  'install',
  'i',
  'ci',
  'remove',
  'rm',
  'uninstall',
  'update',
  'up',
  'upgrade',
  'dlx',
  'exec',
  'x',
  'create',
  'init',
  'why',
  'list',
  'ls',
  'link',
  'unlink',
  'publish',
  'pack',
  'outdated',
  'audit',
  'store',
  'env',
  'config',
  'import',
  'rebuild',
  'prune',
  'patch',
  'patch-commit',
  'deploy',
  'setup',
  'self-update',
  'licenses',
  'info',
  'view',
  'workspaces',
  'workspace',
  'global',
  'cache',
  'version',
  'login',
  'logout',
  'help',
  'dedupe',
  'fetch',
  'approve-builds',
  'node',
  'bin',
  'root',
  'whoami',
  'set',
  'get',
  'dev-dependencies',
  'pm',
  'build-scripts',
  'npx',
  'bunx',
]);

// `npm <x>` runs a script only for these; everything else is an npm command.
const NPM_SCRIPT_SHORTCUTS = new Set(['test', 'start', 'stop', 'restart']);

const RUN_SUBCOMMANDS = new Set(['run', 'run-script']);
const FILTER_FLAGS = new Set(['--filter', '-F', '--workspace', '-w']);
const INLINE_FILTER = /^(?:--filter|--workspace|-w|-F)=(.+)$/;
// Flags that run the script in every workspace package, which can't be narrowed down.
const ALL_WORKSPACES_FLAGS = new Set(['-r', '--recursive', '-ws', '--workspaces', '--if-present']);
const ALL_WORKSPACES = '*';
// A package spec (`pkg@1`, `@scope/pkg`, `github:x/y`), not a script name.
const PACKAGE_SPEC_CHARACTERS = /[/@:]/;
const ENV_VARIABLE_START = '$';

const TURBO_FILTER_FLAGS = new Set(['--filter', '-F']);
const INLINE_TURBO_FILTER = /^(?:--filter|-F)=(.+)$/;

const SURROUNDING_QUOTES = /^['"]|['"]$/g;
const NEGATION = /^!/;
const DEPENDENCY_DOTS = /^\.\.\.\^?|\^?\.\.\.$/g;
const SURROUNDING_BRACES = /^\{|\}$/g;
const DYNAMIC_FILTER_CHARACTER = '[';
const GLOB_SPECIAL_CHARACTERS = /[.+?^${}()|[\]\\]/g;
const DOUBLE_STAR = /\*\*/g;
const SINGLE_STAR = /\*/g;

/**
 * Reports missing-script for `npm run x`, `npm test`, `pnpm x`, `yarn x` and `bun x` when no
 * manifest in scope has the script (pnpm, yarn and bun also accept a binary in node_modules/.bin),
 * and missing-workspace for `--filter`, `-w` and `yarn workspace` values that match no package.
 * Skips builtins, package specs, `$VARIABLE` scripts and commands that run in every package.
 *
 * @param {string} tool npm, pnpm, yarn or bun.
 * @param {string[]} args The words after the tool.
 * @param {number} line
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 * @throws {TypeError} When a manifest's `scripts` field isn't an object.
 */
export function checkPackageManagerCommand(tool, args, line, project, add) {
  const { filters, rest } = parsePackageManagerArgs(tool, args);
  const targets = resolveFilters(filters, line, project, add);
  const script = scriptName(tool, rest);
  if (!script || script.startsWith(ENV_VARIABLE_START) || targets === 'any') {
    return;
  }

  const manifests = targets ?? [project.manifest].filter(Boolean);
  if (manifests.length === 0) {
    return;
  }

  const hasScript = manifests.some((manifest) => hasOwnScript(manifest, script));
  const isBinary = !targets && tool !== 'npm' && hasLocalBinary(project, script);
  if (!hasScript && !isBinary) {
    const names = manifests.map((manifest) => manifest.name ?? 'package.json').join(', ');
    add(line, 'missing-script', `"${script}" isn't a script in ${names}`);
  }
}

/**
 * Reports missing-task for turbo tasks that aren't in turbo.json, and missing-workspace for
 * `--filter` values that match no package. Does nothing when turbo.json defines no tasks.
 *
 * @param {string[]} args The words after `turbo`.
 * @param {number} line
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkTurboCommand(args, line, project, add) {
  if (!project.turboTasks.size) {
    return;
  }

  const { filters, tasks } = parseTurboArgs(args);
  resolveFilters(filters, line, project, add);

  for (const task of tasks) {
    if (!project.turboTasks.has(task)) {
      add(line, 'missing-task', `"${task}" isn't a task in turbo.json`);
    }
  }
}

// Splits the arguments into workspace filters and the rest. The rest starts at the first word
// that isn't a flag, and from there keeps every word.
function parsePackageManagerArgs(tool, args) {
  const filters = [];
  const rest = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const inline = arg.match(INLINE_FILTER);
    const takesValue = FILTER_FLAGS.has(arg) || (tool === 'yarn' && arg === 'workspace');
    if (inline) {
      filters.push(inline[1]);
    } else if (takesValue && args[index + 1]) {
      filters.push(args[++index]);
    } else if (ALL_WORKSPACES_FLAGS.has(arg)) {
      filters.push(ALL_WORKSPACES);
    } else if (!arg.startsWith('-') || rest.length > 0) {
      rest.push(arg);
    }
  }

  return { filters, rest };
}

// The script a command runs, or null for a builtin. `npm x` runs a script only for the
// shortcuts; pnpm, yarn and bun run any name that isn't one of their own commands.
function scriptName(tool, [first, second]) {
  if (first === undefined) {
    return null;
  }

  if (RUN_SUBCOMMANDS.has(first)) {
    return second;
  }

  if (tool === 'npm') {
    return NPM_SCRIPT_SHORTCUTS.has(first) ? first : null;
  }

  if (PACKAGE_MANAGER_BUILTINS.has(first) || PACKAGE_SPEC_CHARACTERS.test(first)) {
    return null;
  }

  return first === 'turbo' ? null : first;
}

function parseTurboArgs(args) {
  const filters = [];
  const tasks = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const inline = arg.match(INLINE_TURBO_FILTER);
    if (inline) {
      filters.push(inline[1]);
    } else if (TURBO_FILTER_FLAGS.has(arg)) {
      // A trailing `--filter` with no value has nothing to check.
      if (args[index + 1] !== undefined) {
        filters.push(args[++index]);
      }
    } else if (arg !== 'run' && !arg.startsWith('-')) {
      tasks.push(arg);
    }
  }

  return { filters, tasks };
}

// Turns filter values into the matching workspace manifests. Returns null when there was no
// filter, 'any' when a filter is too dynamic to check (or nothing matched), and reports each
// filter that matches no package.
function resolveFilters(filters, line, project, add) {
  if (filters.length === 0) {
    return null;
  }

  if (filters.includes(ALL_WORKSPACES) || project.workspaces.length === 0) {
    return 'any';
  }

  const matched = [];

  for (const filter of filters) {
    const cleaned = cleanFilter(filter);
    if (cleaned === '' || cleaned.includes(DYNAMIC_FILTER_CHARACTER)) {
      return 'any';
    }

    const hits = matchWorkspaces(project, globToRegExp(cleaned));
    if (hits.length === 0) {
      const have = project.workspaces
        .map(({ name }) => name)
        .slice(0, MAX_LISTED_WORKSPACES)
        .join(', ');
      add(
        line,
        'missing-workspace',
        `--filter "${filter}" matches no workspace package (have: ${have})`,
      );
    }

    matched.push(...hits.map(({ manifest }) => manifest));
  }

  return matched.length ? matched : 'any';
}

// Strips quotes, a leading `!`, pnpm's `...` and `^` dependency markers and `{dir}` braces.
function cleanFilter(filter) {
  return filter
    .replace(SURROUNDING_QUOTES, '')
    .replace(NEGATION, '')
    .replace(DEPENDENCY_DOTS, '')
    .replace(SURROUNDING_BRACES, '');
}

// A filter matches a package by name or by its folder relative to the workspace root, with or
// without a leading `./`.
function matchWorkspaces(project, pattern) {
  return project.workspaces.filter(({ name, dir }) => {
    const relativeDir = path.relative(project.workspaceRoot, dir);
    return (
      pattern.test(name ?? '') || pattern.test(relativeDir) || pattern.test(`./${relativeDir}`)
    );
  });
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(GLOB_SPECIAL_CHARACTERS, '\\$&')
    .replace(DOUBLE_STAR, '.*')
    .replace(SINGLE_STAR, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

// True when the manifest's `scripts` object has the script as its own key. `in` would also find
// `toString` and other inherited names, and a non-object `scripts` has no scripts.
function hasOwnScript(manifest, script) {
  const scripts = manifest.scripts;
  return typeof scripts === 'object' && scripts !== null && Object.hasOwn(scripts, script);
}
