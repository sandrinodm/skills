// Counts findings and prints them as text.

import { RULE_NAMES } from './rules.mjs';

/**
 * Findings per level, overall and for each rule.
 *
 * @typedef {object} Counts
 * @property {number} error
 * @property {number} review
 * @property {Record<string, { error: number, review: number }>} byRule
 */
/** @typedef {import('./rules.mjs').Finding} Finding */

// Named rules (types, files) sort after the numbered ones in the summary.
const NAMED_RULE_ORDER = 100;
const COLUMNS = { line: 4, level: 6, rule: 5, id: 22 };

/**
 * Totals the findings by level, overall and per rule.
 *
 * @param {Finding[]} findings
 * @returns {Counts}
 */
export function countFindings(findings) {
  const counts = { error: 0, review: 0, byRule: {} };

  for (const finding of findings) {
    counts[finding.level]++;
    const rule = String(finding.rule);
    counts.byRule[rule] ??= { error: 0, review: 0 };
    counts.byRule[rule][finding.level]++;
  }

  return counts;
}

/**
 * Prints the findings grouped by file, then the totals and a line per rule.
 *
 * @param {Finding[]} findings sorted by file and line
 * @param {Counts} counts
 * @param {number} fileCount how many files were checked
 * @returns {void}
 */
export function printFindings(findings, counts, fileCount) {
  let currentFile = null;

  for (const finding of findings) {
    if (finding.file !== currentFile) {
      currentFile = finding.file;
      console.log(`\n${finding.file}`);
    }

    const columns = [
      String(finding.line).padStart(COLUMNS.line),
      finding.level.padEnd(COLUMNS.level),
      String(finding.rule).padEnd(COLUMNS.rule),
      finding.id.padEnd(COLUMNS.id),
    ];
    const scope = finding.scope ? ` [${finding.scope}]` : '';
    console.log(
      `  ${columns[0]}  ${columns[1]}  ${columns[2]} ${columns[3]} ${finding.message}${scope}`,
    );
  }

  const perRule = Object.entries(counts.byRule)
    .sort(([a], [b]) => ruleOrder(a) - ruleOrder(b))
    .map(
      ([rule, { error, review }]) =>
        `  ${rule.padEnd(COLUMNS.level)} ${RULE_NAMES[rule] ?? ''}: ${countLabel(error, review)}`,
    );

  console.log(`\n${counts.error} errors, ${counts.review} to review in ${fileCount} files`);

  if (perRule.length > 0) {
    console.log(perRule.join('\n'));
  }
}

function countLabel(error, review) {
  return `${error} error, ${review} review`;
}

function ruleOrder(rule) {
  return Number.isNaN(Number(rule)) ? NAMED_RULE_ORDER + rule.length : Number(rule);
}
