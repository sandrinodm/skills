// Loads the TypeScript compiler the checks parse with.

import path from 'node:path';
import { createRequire } from 'node:module';

import { UsageError } from './usage-error.mjs';

/** @typedef {typeof import('typescript')} TypeScript */

/**
 * Loads a `typescript` package that has the JavaScript compiler API (5.x or 6.x). Loading a package
 * runs its code, so it's only looked up where the person running the script chose: the folder
 * given with `--typescript`, or else the current directory, then a copy put on PATH by `npx -p
 * typescript@6`. Never from inside the checked folders, so checking code you don't trust doesn't
 * run its `node_modules`. Throws a UsageError naming the `npx` command to run when none is
 * found, including when the only copy is TypeScript 7.
 *
 * @param {string | null} explicitDir the `--typescript` folder, or null
 * @returns {TypeScript}
 */
export function loadTypeScript(explicitDir) {
  const bases = explicitDir
    ? [path.resolve(explicitDir)]
    : [
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
    ? `typescript ${nativeVersion} is the native compiler, which has no JavaScript parser API`
    : 'no typescript package was found from the current directory';
  throw new UsageError(`style-check: ${reason}. Run it with TypeScript 6 instead:\n  ${rerun}`);
}
