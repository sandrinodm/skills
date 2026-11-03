// The files rule against import cycles between the checked files.

import path from 'node:path';

import { realPath, resolveImport } from './source-files.mjs';

/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
/** @typedef {import('./source-files.mjs').ParsedFile} ParsedFile */

/** @typedef {import('./rules.mjs').Finding} Finding */

/**
 * The files rule: import cycles between the checked files, one finding per cycle, on the first
 * import of the cycle. `import type` and `export type` don't count.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile[]} files
 * @returns {Finding[]}
 */
export function checkImportCycles(ts, files) {
  const byPath = new Map(files.map((file) => [realPath(file.path), file]));
  const edges = new Map();

  for (const file of files) {
    const targets = [];

    for (const node of file.source.statements) {
      const isModuleReference = ts.isImportDeclaration(node) || ts.isExportDeclaration(node);
      const specifier =
        isModuleReference && !isTypeOnly(ts, node) ? node.moduleSpecifier?.text : null;
      const resolved = specifier?.startsWith('.') ? resolveImport(file.path, specifier) : null;
      if (resolved && byPath.has(realPath(resolved))) {
        targets.push({ target: realPath(resolved), node });
      }
    }

    edges.set(realPath(file.path), targets);
  }

  return findCycles(edges).map((cycle) => {
    const file = byPath.get(cycle[0]);
    const next = cycle[1] ?? cycle[0];
    const edge = edges.get(cycle[0]).find(({ target }) => target === next);
    const names = [...cycle, cycle[0]].map((file) => path.relative(process.cwd(), file));
    return {
      file: file.path,
      line: file.lineOf(edge.node.getStart(file.source)) + 1,
      rule: 'files',
      id: 'import-cycle',
      level: 'error',
      message: `import cycle: ${names.join(' → ')}`,
      scope: 'files',
    };
  });
}

// `import type` and `export type` are erased, so they can't form a runtime cycle. An import whose
// names are all marked inline (`import { type B } from './b'`) is kept as `import {} from './b'`
// under `verbatimModuleSyntax`, which the skill recommends, so it still counts.
function isTypeOnly(ts, node) {
  return ts.isImportDeclaration(node) ? Boolean(node.importClause?.isTypeOnly) : node.isTypeOnly;
}

// Returns one real cycle for each strongly connected group of files (Tarjan's algorithm), including
// a file that imports itself.
function findCycles(edges) {
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];
  let counter = 0;

  const connect = (node) => {
    index.set(node, counter);
    low.set(node, counter);
    counter++;
    stack.push(node);
    onStack.add(node);

    for (const { target } of edges.get(node) ?? []) {
      if (!index.has(target)) {
        connect(target);
        low.set(node, Math.min(low.get(node), low.get(target)));
      } else if (onStack.has(target)) {
        low.set(node, Math.min(low.get(node), index.get(target)));
      }
    }

    if (low.get(node) !== index.get(node)) {
      return;
    }

    const group = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      group.push(member);
    } while (member !== node);

    const importsItself = (edges.get(node) ?? []).some(({ target }) => target === node);
    if (group.length > 1) {
      cycles.push(cycleThrough(edges, new Set(group), group.at(-1)));
    } else if (importsItself) {
      cycles.push([node]);
    }
  };

  for (const node of edges.keys()) {
    if (!index.has(node)) {
      connect(node);
    }
  }

  return cycles;
}

// The shortest cycle through `start` inside a strongly connected group, found breadth-first so
// every step is a real import. Returns the files in order, without repeating `start` at the end.
function cycleThrough(edges, group, start) {
  const parents = new Map([[start, null]]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const { target } of edges.get(current) ?? []) {
      if (target === start) {
        return routeTo(parents, current);
      }

      if (group.has(target) && !parents.has(target)) {
        parents.set(target, current);
        queue.push(target);
      }
    }
  }

  return [start];
}

function routeTo(parents, end) {
  const route = [];

  for (let current = end; current !== null; current = parents.get(current)) {
    route.unshift(current);
  }

  return route;
}
