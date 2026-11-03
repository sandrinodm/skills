// Test fixtures: small repos written to a temp directory, and a shortcut that checks one README
// in them.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { checkReadmes } from '../check-readmes.mjs';

const TEMP_PREFIX = 'check-readme-';
const JSON_INDENT = 2;

const created = [];

/**
 * Writes a repo into a new temp directory. Each key is a path relative to the repo root; a string
 * value is written as is, any other value as JSON, and a key ending in `/` makes an empty folder.
 * The repo gets a `.git` folder so the checks stop looking for the repo root there.
 *
 * @param {Record<string, unknown>} files
 * @returns {string} The repo's absolute path.
 */
export function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  created.push(root);

  for (const [relativePath, contents] of Object.entries({ '.git/': '', ...files })) {
    const target = path.join(root, relativePath);
    if (relativePath.endsWith('/')) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    const text =
      typeof contents === 'string' ? contents : JSON.stringify(contents, null, JSON_INDENT);
    fs.writeFileSync(target, text);
  }

  return root;
}

/**
 * Writes a repo with `makeRepo` and checks one README in it.
 *
 * @param {Record<string, unknown>} files
 * @param {{ readmePath?: string, styleOnly?: boolean }} [options] `readmePath` is relative to the
 *   repo root and defaults to README.md.
 * @returns {import('../findings.mjs').Finding[]}
 */
export function findingsFor(files, { readmePath = 'README.md', styleOnly = false } = {}) {
  const root = makeRepo(files);
  const [report] = checkReadmes([path.join(root, readmePath)], { styleOnly });
  return report.findings;
}

/**
 * The findings for one rule.
 *
 * @param {import('../findings.mjs').Finding[]} findings
 * @param {string} rule
 * @returns {import('../findings.mjs').Finding[]}
 */
export function withRule(findings, rule) {
  return findings.filter((finding) => finding.rule === rule);
}

/**
 * Deletes every repo `makeRepo` created. Call it from an `after` hook.
 *
 * @returns {void}
 */
export function removeRepos() {
  for (const root of created.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * Joins lines into README text, so fixtures read like the file they stand for.
 *
 * @param {...string} lines
 * @returns {string}
 */
export function readme(...lines) {
  return lines.join('\n');
}
