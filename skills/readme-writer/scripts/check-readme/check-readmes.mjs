// Runs every check on each README and collects the findings into one report per file.

import fs from 'node:fs';
import path from 'node:path';

import { checkBadgeFacts, checkBadges } from './badges.mjs';
import { checkCommands } from './commands.mjs';
import { checkCopiedSentences } from './copied-sentences.mjs';
import { checkEnv } from './env.mjs';
import { createFindingList } from './findings.mjs';
import { checkHeadings } from './headings.mjs';
import { checkLicense } from './license.mjs';
import { checkLinks } from './links.mjs';
import { checkLists } from './lists.mjs';
import { parseMarkdown } from './markdown.mjs';
import { checkPackage } from './package.mjs';
import { checkPackageManager } from './package-manager.mjs';
import { checkPorts } from './ports.mjs';
import { loadProject } from './project.mjs';
import { checkProse } from './prose.mjs';
import { checkStructure } from './structure.mjs';

/**
 * @typedef {{
 *   file: string,
 *   words: number,
 *   lines: number,
 *   findings: import('./findings.mjs').Finding[],
 * }} Report
 */

/**
 * A report while the checks run, with the parsed README the cross-file check reads.
 *
 * @typedef {Report & { doc: import('./markdown.mjs').Doc }} ParsedReport
 */

// Checks that read only the README. Findings on the same line keep this order.
const STYLE_CHECKS = [checkHeadings, checkProse, checkLists, checkBadges, checkStructure];

// Checks that compare the README with the repo around it.
const REPO_CHECKS = [
  checkLinks,
  checkCommands,
  checkLicense,
  checkBadgeFacts,
  checkPackage,
  checkPackageManager,
  checkPorts,
  checkEnv,
];

/**
 * Checks each README, then looks for sentences copied across them.
 *
 * @param {string[]} files README paths, relative to the working directory or absolute. They're
 *   reported as given.
 * @param {{ styleOnly: boolean }} options `styleOnly` skips every check that reads the repo.
 * @returns {Report[]} One per file, in the same order, findings sorted by line.
 * @throws {Error} When a README can't be read.
 */
export function checkReadmes(files, { styleOnly }) {
  const reports = files.map((file) => checkFile(file, { styleOnly }));
  checkCopiedSentences(reports);
  return reports.map(({ doc, ...report }) => report);
}

function checkFile(file, { styleOnly }) {
  const doc = parseMarkdown(fs.readFileSync(file, 'utf8'));
  const { add, unique } = createFindingList();

  for (const check of STYLE_CHECKS) {
    check(doc, add);
  }

  if (!styleOnly) {
    const project = loadProject(path.resolve(file));
    for (const check of REPO_CHECKS) {
      check(doc, project, add);
    }
  }

  return { file, words: doc.wordCount, lines: doc.lines.length, findings: unique(), doc };
}
