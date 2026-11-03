// Reads the repo around a README: the nearest package.json, the workspace root and its packages,
// turbo tasks, Makefile and justfile targets, and the lockfile.

import fs from 'node:fs';
import path from 'node:path';

const LINE_BREAK = /\r?\n/;
const MAKE_TARGET = /^([A-Za-z0-9_.-]+)\s*:(?!=)/;
// A recipe line: a name, optional parameters (which may have `=` defaults), then `:`. `name :=` is
// an assignment, not a recipe.
const JUST_RECIPE = /^@?([A-Za-z0-9_-]+)(?:\s[^:]*)?:(?!=)/;
const PNPM_WORKSPACE_ENTRY = /^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/;
const TRAILING_GLOB = /\/\*\*?$/;
const TURBO_PACKAGE_SEPARATOR = '#';

// The first lockfile found decides the package manager, in this order.
const LOCK_FILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];

/**
 * Example env files a README is expected to mention, in the order they're looked for.
 *
 * @type {readonly string[]}
 */
export const ENV_EXAMPLE_FILES = Object.freeze([
  '.env.example',
  '.env.sample',
  '.env.template',
  '.dev.vars.example',
]);

/**
 * @typedef {Record<string, any>} Manifest A parsed package.json.
 * @typedef {{ name: string | undefined, dir: string, manifest: Manifest }} WorkspacePackage
 * @typedef {{
 *   lockManager: string | null,
 *   lockFile: string | null,
 *   dir: string,
 *   repoRoot: string,
 *   packageDir: string | null,
 *   manifest: Manifest | null,
 *   workspaceRoot: string | null,
 *   rootManifest: Manifest | null,
 *   workspaces: WorkspacePackage[],
 *   turboTasks: Set<string>,
 *   makeTargets: Set<string> | null,
 *   justRecipes: Set<string> | null,
 * }} Project
 */

/**
 * Loads what the repo checks compare a README with. The repo root is the nearest folder with a
 * `.git`; without one (a copied or extracted tree) the search goes up to the filesystem root, and
 * the workspace root, or failing that the README's folder, stands in for the repo root. Missing or
 * unparsable files count as absent.
 *
 * @param {string} readmePath Absolute path of the README.
 * @returns {Project}
 */
export function loadProject(readmePath) {
  const dir = path.dirname(readmePath);
  const gitRoot = findUp(dir, (candidate) => fs.existsSync(path.join(candidate, '.git')));
  const packageDir = findUp(
    dir,
    (candidate) => fs.existsSync(path.join(candidate, 'package.json')),
    gitRoot,
  );
  const manifest = packageDir ? readJson(path.join(packageDir, 'package.json')) : null;
  const workspaceRoot = findWorkspaceRoot(dir, gitRoot);
  const repoRoot = gitRoot ?? workspaceRoot ?? dir;
  const rootManifest = workspaceRoot ? readJson(path.join(workspaceRoot, 'package.json')) : null;
  const workspaces = workspaceRoot ? listWorkspacePackages(workspaceRoot) : [];
  const lock = findLockFile([workspaceRoot, packageDir, repoRoot]);
  const targetDirs = [dir, workspaceRoot, repoRoot];
  return {
    lockManager: lock?.manager ?? null,
    lockFile: lock?.file ?? null,
    dir,
    repoRoot,
    packageDir,
    manifest,
    workspaceRoot,
    rootManifest,
    workspaces,
    turboTasks: readTurboTasks(workspaceRoot),
    makeTargets: readTargets(targetDirs, 'Makefile', MAKE_TARGET),
    justRecipes: readTargets(targetDirs, 'justfile', JUST_RECIPE),
  };
}

/**
 * Reads a file as UTF-8.
 *
 * @param {string} file
 * @returns {string | null} Null when the file is missing, unreadable or a directory.
 */
export function readTextFile(file) {
  try {
    return fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8') : null;
  } catch {
    return null;
  }
}

/**
 * True when a binary of that name is installed in `node_modules/.bin` next to the README, its
 * package or the workspace root, so `pnpm <name>` runs it even without a script.
 *
 * @param {Project} project
 * @param {string} name
 * @returns {boolean}
 */
export function hasLocalBinary(project, name) {
  const dirs = [project.dir, project.packageDir, project.workspaceRoot].filter(Boolean);
  return dirs.some((dir) => fs.existsSync(path.join(dir, 'node_modules', '.bin', name)));
}

// Walks up from `start` to the first folder that passes `predicate`. Stops after checking
// `stopAt`, or at the filesystem root.
function findUp(start, predicate, stopAt) {
  let current = start;

  while (true) {
    if (predicate(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current || current === stopAt) {
      return null;
    }

    current = parent;
  }
}

function findWorkspaceRoot(start, repoRoot) {
  return findUp(
    start,
    (candidate) => {
      if (fs.existsSync(path.join(candidate, 'pnpm-workspace.yaml'))) {
        return true;
      }

      const manifest = readJson(path.join(candidate, 'package.json'));
      return Boolean(manifest?.workspaces);
    },
    repoRoot,
  );
}

// The workspace's packages, with the root package last. pnpm-workspace.yaml wins over the
// package.json `workspaces` field. Only `dir/*` and `dir/**` globs are expanded, one level deep.
function listWorkspacePackages(root) {
  const manifest = readJson(path.join(root, 'package.json'));
  const patterns = workspacePatterns(root, manifest).filter((value) => !value.startsWith('!'));
  const packages = [];

  for (const pattern of patterns) {
    const base = pattern.replace(TRAILING_GLOB, '');
    const dirs = pattern.endsWith('*') ? listDirs(path.join(root, base)) : [path.join(root, base)];
    for (const dir of dirs) {
      const packageManifest = readJson(path.join(dir, 'package.json'));
      if (packageManifest) {
        packages.push({ name: packageManifest.name, dir, manifest: packageManifest });
      }
    }
  }

  if (manifest) {
    packages.push({ name: manifest.name, dir: root, manifest });
  }

  return packages;
}

// Every `- entry` line of pnpm-workspace.yaml counts, without parsing the YAML.
function workspacePatterns(root, manifest) {
  const pnpmFile = path.join(root, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmFile)) {
    return fs
      .readFileSync(pnpmFile, 'utf8')
      .split(LINE_BREAK)
      .map((line) => line.match(PNPM_WORKSPACE_ENTRY)?.[1])
      .filter(Boolean);
  }

  return Array.isArray(manifest?.workspaces)
    ? manifest.workspaces
    : (manifest?.workspaces?.packages ?? []);
}

// Task names from turbo.json (`tasks`, or `pipeline` in turbo 1), without a `package#` prefix.
function readTurboTasks(workspaceRoot) {
  const turbo = workspaceRoot ? readJson(path.join(workspaceRoot, 'turbo.json')) : null;
  return new Set(
    Object.keys(turbo?.tasks ?? turbo?.pipeline ?? {}).map((task) =>
      task.split(TURBO_PACKAGE_SEPARATOR).pop(),
    ),
  );
}

// The targets in the first of `dirs` that has the file, or null when none has it.
function readTargets(dirs, fileName, pattern) {
  for (const dir of dirs.filter(Boolean)) {
    const file = path.join(dir, fileName);
    if (fs.existsSync(file)) {
      const targets = fs
        .readFileSync(file, 'utf8')
        .split(LINE_BREAK)
        .map((line) => line.match(pattern)?.[1])
        .filter(Boolean);
      return new Set(targets);
    }
  }

  return null;
}

function findLockFile(dirs) {
  for (const dir of dirs.filter(Boolean)) {
    for (const [file, manager] of LOCK_FILES) {
      if (fs.existsSync(path.join(dir, file))) {
        return { file, manager };
      }
    }
  }

  return null;
}

function listDirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}
