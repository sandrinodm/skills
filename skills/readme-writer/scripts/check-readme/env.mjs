// Env checks: a package with an example env file should mention the file or its variables, so a
// reader knows what to set.

import fs from 'node:fs';
import path from 'node:path';

import { ENV_EXAMPLE_FILES } from './project.mjs';

const LINE_BREAK = /\r?\n/;
const ENV_ASSIGNMENT = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/;

/**
 * Reports env-not-documented when the README's folder has an example env file whose variables
 * the README doesn't all mention, and the README doesn't mention the file either. Only the first
 * example file found counts. Lowercase variable names are ignored.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 * @throws {Error} When the example env file exists but can't be read.
 */
export function checkEnv(doc, project, add) {
  const example = ENV_EXAMPLE_FILES.map((name) => path.join(project.dir, name)).find((file) =>
    fs.existsSync(file),
  );
  if (!example) {
    return;
  }

  const names = fs
    .readFileSync(example, 'utf8')
    .split(LINE_BREAK)
    .map((line) => line.match(ENV_ASSIGNMENT)?.[1])
    .filter(Boolean);
  const text = doc.lines.join('\n');
  const missing = names.filter((name) => !text.includes(name));
  const fileName = path.basename(example);
  if (missing.length && !text.includes(fileName)) {
    add(
      1,
      'env-not-documented',
      `${fileName} defines ${missing.join(', ')} ` +
        'but the README mentions neither the file nor those variables',
    );
  }
}
