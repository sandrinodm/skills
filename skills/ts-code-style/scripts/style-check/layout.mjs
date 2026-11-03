// The files rule for names and imports, and rule 11 for line width.

import path from 'node:path';

import { resolveImport } from './source-files.mjs';

/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
/** @typedef {import('./source-files.mjs').ParsedFile} ParsedFile */
/** @typedef {import('./rules.mjs').Finding} Finding */
/** @typedef {import('./rules.mjs').AddFinding} AddFinding */
const FRAMEWORK_FOLDERS = new Set(['routes', 'pages', 'app']);
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const INDEX_FILE = /(^|\/)index\.[cm]?[jt]sx?$/;
const IMPORT_LINE = /^\s*(import|export) .* from /;
const FRAMEWORK_FILE_PREFIX = /^[[(_$+@]/;
const MIN_DEEP_IMPORT_LEVELS = 3;
/**
 * The files rule: a file name (before the first dot) that isn't kebab-case, outside framework route
 * folders, and a test kept in a `__tests__`, `tests` or `test` folder.
 *
 * @param {ParsedFile} file
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkFileName(file, add) {
  const segments = file.path.split(path.sep);
  const name = path.basename(file.path).split('.')[0];
  const isFrameworkName =
    segments.some((segment) => FRAMEWORK_FOLDERS.has(segment)) || FRAMEWORK_FILE_PREFIX.test(name);
  if (!isFrameworkName && name !== '' && !KEBAB_CASE.test(name)) {
    add(0, {
      rule: 'files',
      id: 'file-name',
      level: 'error',
      message: `file name "${path.basename(file.path)}" isn't kebab-case`,
      scope: 'files',
    });
  }

  if (
    segments.includes('__tests__') ||
    (file.isTest && segments.some((segment) => segment === 'tests' || segment === 'test'))
  ) {
    add(0, {
      rule: 'files',
      id: 'test-location',
      level: 'error',
      message: 'test in a separate tests folder; put it beside the file it tests',
      scope: 'files',
    });
  }
}

/**
 * The files rule: a relative import that climbs MIN_DEEP_IMPORT_LEVELS folders or more, and an
 * import that resolves to an index barrel.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkImports(ts, file, add) {
  for (const node of file.source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) {
      continue;
    }

    const specifier = node.moduleSpecifier?.text;
    if (!specifier?.startsWith('.')) {
      continue;
    }

    const levels = specifier.split('/').filter((part) => part === '..').length;
    if (levels >= MIN_DEEP_IMPORT_LEVELS) {
      add(node, {
        rule: 'files',
        id: 'deep-import',
        level: 'review',
        message: `"${specifier}" climbs ${levels} folders; use a package.json#imports alias`,
        scope: 'files',
      });
    }

    const resolved = resolveImport(file.path, specifier);
    if (resolved && INDEX_FILE.test(resolved) && !ts.isExportDeclaration(node)) {
      add(node, {
        rule: 'files',
        id: 'barrel-import',
        level: 'review',
        message:
          `"${specifier}" imports through an index barrel; ` +
          'import from the file that owns the code',
        scope: 'files',
      });
    }
  }
}

/**
 * Rule 11: lines longer than `width`, except import and export lines. Appends to `findings`.
 *
 * @param {ParsedFile} file
 * @param {number} width the limit; 0 skips the check
 * @param {Finding[]} findings the list to append to
 * @returns {void}
 */
export function checkLineWidth(file, width, findings) {
  if (!width) {
    return;
  }

  for (const [index, line] of file.lines.entries()) {
    if (line.length > width && !IMPORT_LINE.test(line)) {
      findings.push({
        file: file.path,
        line: index + 1,
        rule: '11',
        id: 'line-width',
        level: 'review',
        message: `${line.length} columns (limit ${width})`,
      });
    }
  }
}
