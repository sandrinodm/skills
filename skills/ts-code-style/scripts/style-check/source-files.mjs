// Finding, reading, parsing and resolving the files to check.

import fs from 'node:fs';
import path from 'node:path';

import { localExportNames } from './ast.mjs';
import { UsageError } from './usage-error.mjs';

/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;
const DECLARATION_FILE_PATTERN = /\.d\.[cm]?ts$/;
const GENERATED_FILE_PATTERN = /\.gen\.[cm]?[jt]sx?$/;
const TEST_FILE_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next']);

/**
 * A parsed source file, with the facts the checks need about it.
 *
 * @typedef {object} ParsedFile
 * @property {string} path the path as given on the command line
 * @property {string} text
 * @property {string[]} lines the text split on `\n`; a CRLF file's lines keep their `\r`
 * @property {string} eol `'\r'` for a CRLF file, otherwise `''`, appended to inserted lines
 * @property {import('typescript').SourceFile} source
 * @property {boolean} isJavaScript a .js, .jsx, .mjs or .cjs file
 * @property {boolean} isTest a `*.test.*` or `*.spec.*` file, or a file under `e2e/`
 * @property {boolean} usesEffect imports `effect` or an `@effect/*` package
 * @property {Set<string>} localExports names exported with `export { … }` or `export default name`
 * @property {(position: number) => number} lineOf the 0-based line of a text position
 */

/** The TypeScript script kind for each file extension; anything else parses as TS. */
export const SCRIPT_KINDS = {
  '.tsx': 'TSX',
  '.jsx': 'JSX',
  '.js': 'JS',
  '.mjs': 'JS',
  '.cjs': 'JS',
};
const JAVASCRIPT_FILE = /\.[cm]?jsx?$/;
const EMITTED_EXTENSION = /\.([cm]?)js(x?)$/;
const EFFECT_IMPORT = /^(?:effect|@effect\/.+)$/;
/**
 * Reads and parses one file, with the facts the checks need about it.
 *
 * @param {TypeScript} ts
 * @param {string} file the path as given
 * @returns {ParsedFile}
 */
export function parseFile(ts, file) {
  const text = fs.readFileSync(file, 'utf8');
  const kind = ts.ScriptKind[SCRIPT_KINDS[path.extname(file)] ?? 'TS'];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const imports = source.statements.filter(ts.isImportDeclaration);
  const specifiers = imports.map((node) => node.moduleSpecifier.text);
  return {
    path: file,
    text,
    lines: text.split('\n'),
    eol: text.includes('\r\n') ? '\r' : '',
    source,
    isJavaScript: JAVASCRIPT_FILE.test(file),
    isTest: TEST_FILE_PATTERN.test(file) || file.split(path.sep).includes('e2e'),
    usesEffect: specifiers.some((specifier) => EFFECT_IMPORT.test(specifier)),
    localExports: localExportNames(ts, source),
    lineOf: (position) => source.getLineAndCharacterOfPosition(position).line,
  };
}

/**
 * Resolves a relative import the way a bundler would: the exact file, the TypeScript source for a
 * `.js` specifier, an added extension, or a folder's index file.
 *
 * @param {string} fromFile the importing file
 * @param {string} specifier a relative specifier such as `./orders.js`
 * @returns {string | null} the path, or null when nothing on disk matches
 */
export function resolveImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const sourceForEmitted = base.replace(EMITTED_EXTENSION, '.$1ts$2');
  const candidates = [
    base,
    sourceForEmitted,
    ...['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs'].map((extension) => base + extension),
    ...['index.ts', 'index.tsx', 'index.js', 'index.mjs'].map((name) => path.join(base, name)),
  ];
  return (
    candidates.find((candidate) => fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) ??
    null
  );
}

/**
 * Each file once, even when a folder and a file inside it, or a symlink and its target, are both
 * given. Keeps the first path seen for each.
 *
 * @param {string[]} files
 * @returns {string[]}
 */
export function uniqueFiles(files) {
  const seen = new Map();

  for (const file of files) {
    if (!seen.has(realPath(file))) {
      seen.set(realPath(file), file);
    }
  }

  return [...seen.values()];
}

/**
 * The file's real location, so a symlink and its target count as one file. Falls back to the
 * absolute path when the file can't be resolved.
 *
 * @param {string} file
 * @returns {string}
 */
export function realPath(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

/**
 * The source files at a path: the path itself when it's a file, or every .ts, .tsx, .mts, .cts,
 * .js, .jsx, .mjs and .cjs file under a folder, skipping declaration files, generated files and
 * SKIPPED_DIRECTORIES. Throws a UsageError when the path doesn't exist.
 *
 * @param {string} target a file or folder
 * @returns {string[]}
 */
export function listSourceFiles(target) {
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  if (!stat) {
    throw new UsageError(`style-check: ${target} doesn't exist`);
  }

  if (stat.isFile()) {
    return [target];
  }

  const files = [];

  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    const isSource =
      SOURCE_FILE_PATTERN.test(entry.name) &&
      !DECLARATION_FILE_PATTERN.test(entry.name) &&
      !GENERATED_FILE_PATTERN.test(entry.name);

    if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) {
      files.push(...listSourceFiles(full));
    } else if (entry.isFile() && isSource) {
      files.push(full);
    }
  }

  return files;
}
