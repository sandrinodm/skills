// Loads the TypeScript compiler the checks parse with.

import path from 'node:path';
import { createRequire } from 'node:module';

import { UsageError } from './usage-error.mjs';

/** @typedef {typeof import('typescript')} TypeScript */

/**
 * Loads a `typescript` package that has the JavaScript compiler API (5.x or 6.x): the copy next to
 * the checked files first, then the current directory's, then one put on PATH by `npx -p
 * typescript@6`. Throws a UsageError naming the `npx` command to run when none is found,
 * including when the project only has TypeScript 7.
 *
 * @param {string[]} targets the paths being checked
 * @returns {TypeScript}
 */
export function loadTypeScript(targets) {
  const bases = [
    ...targets.map((target) => path.resolve(target)),
    process.cwd(),
    ...(process.env.PATH ?? '')
      .split(path.delimiter)
      .filter((entry) => entry.endsWith(path.join('node_modules', '.bin')))
      .map((entry) => path.dirname(entry)),
  ];

  let nativeVersion = null;

  for (const base of bases) {
    let ts;

    try {
      ts = createRequire(path.join(base, 'noop.js'))('typescript');
    } catch {
      continue;
    }

    if (typeof ts.createSourceFile === 'function') {
      return ts;
    }

    nativeVersion ??= ts.version;
  }

  const rerun = `npx -y -p typescript@6 node ${process.argv.slice(1).join(' ')}`;
  const reason = nativeVersion
    ? `the project's typescript ${nativeVersion} is the native compiler, ` +
      'which has no JavaScript parser API'
    : 'the typescript package was not found';
  throw new UsageError(`style-check: ${reason}. Run it with TypeScript 6 instead:\n  ${rerun}`);
}
