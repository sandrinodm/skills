// Import checks: names a README imports from the package must be exported by its entry file.

import path from 'node:path';

import { squash } from './names.mjs';
import { readTextFile } from './project.mjs';

const MAX_LISTED_EXPORTS = 10;

// Files tried after the manifest's own entry fields.
const DEFAULT_ENTRIES = ['src/index.ts', 'src/index.js', 'index.js'];

const NAMED_IMPORT = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/;
const DIST_TO_SOURCE = /^(.*)\/dist\/(.*)\.(m?js|d\.ts)$/;
const STAR_REEXPORT = /export\s*\*\s*from/;
const EXPORTED_DECLARATION = new RegExp(
  String.raw`export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?` +
    String.raw`(?:function\*?|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)`,
  'g',
);
const EXPORT_LIST = /export\s*(?:type\s*)?\{([^}]+)\}/g;
const TYPE_PREFIX = /^type\s+/;
const AS_KEYWORD = /\s+as\s+/;

/**
 * Reports missing-export for each name in an `import { a, b } from '<this package>'` line of a
 * code block that the package's entry file doesn't export. Skips packages whose entry can't be
 * found, and entries that re-export with `export *`, since their names can't be listed.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./project.mjs').Project} project Must have a manifest with a name.
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkImports(doc, project, add) {
  const exported = readExportedNames(project);
  if (!exported) {
    return;
  }

  for (const block of doc.codeBlocks) {
    for (const { line, text } of block.lines) {
      checkImportLine(line, text, { name: project.manifest.name, exported }, add);
    }
  }
}

function checkImportLine(line, text, { name, exported }, add) {
  const match = text.match(NAMED_IMPORT);
  if (!match || (match[2] !== name && squash(match[2]) !== squash(name))) {
    return;
  }

  for (const imported of importedNames(match[1])) {
    if (!exported.has(imported)) {
      add(
        line,
        'missing-export',
        `"${imported}" isn't exported by ${name} ` +
          `(exports: ${[...exported].slice(0, MAX_LISTED_EXPORTS).join(', ')})`,
      );
    }
  }
}

// `a, type B, c as d` imports a, B and c.
function importedNames(list) {
  return list
    .split(',')
    .map((part) => part.trim().replace(TYPE_PREFIX, '').split(AS_KEYWORD)[0])
    .filter(Boolean);
}

// The names exported by every entry file that exists, reading `src/x.ts` when a `dist/x.js`
// entry hasn't been built. Null when no entry exists or one uses `export *`.
function readExportedNames(project) {
  const names = new Set();
  let found = false;

  for (const entry of entryCandidates(project.manifest)) {
    const file = path.join(project.dir, entry);
    const source = readTextFile(file) ?? readTextFile(file.replace(DIST_TO_SOURCE, '$1/src/$2.ts'));
    if (!source) {
      continue;
    }

    if (STAR_REEXPORT.test(source)) {
      return null;
    }

    found = true;
    addExportedNames(source, names);
  }

  return found ? names : null;
}

function entryCandidates(manifest) {
  const rootExport =
    typeof manifest.exports === 'string' ? manifest.exports : manifest.exports?.['.'];
  const exportEntry =
    typeof rootExport === 'string'
      ? rootExport
      : (rootExport?.import ?? rootExport?.default ?? rootExport?.types);
  return [exportEntry, manifest.module, manifest.main, manifest.types, ...DEFAULT_ENTRIES].filter(
    (entry) => typeof entry === 'string',
  );
}

// Declarations (`export const a`, `export default function b`) and export lists
// (`export { a, b as c }`, which exports a and c).
function addExportedNames(source, names) {
  for (const match of source.matchAll(EXPORTED_DECLARATION)) {
    names.add(match[1]);
  }

  for (const match of source.matchAll(EXPORT_LIST)) {
    for (const part of match[1].split(',')) {
      const alias = part.trim().replace(TYPE_PREFIX, '').split(AS_KEYWORD).pop();
      if (alias) {
        names.add(alias);
      }
    }
  }
}
