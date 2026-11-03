// Formats the reports for the terminal or as JSON.

const LINE_COLUMN_WIDTH = 4;
const LEVEL_COLUMN_WIDTH = 5;
const RULE_COLUMN_WIDTH = 22;
const JSON_INDENT = 2;

/**
 * One block per README (its path, size and findings, one per line), then the totals.
 *
 * @param {import('./check-readmes.mjs').Report[]} reports
 * @returns {string} Without a trailing newline.
 */
export function formatText(reports) {
  const totals = { error: 0, slop: 0, note: 0 };
  const lines = [];

  for (const report of reports) {
    lines.push(`${report.file} (${report.lines} lines, ${report.words} words)`);

    if (report.findings.length === 0) {
      lines.push('  no findings');
    }

    for (const finding of report.findings) {
      totals[finding.level]++;
      lines.push(formatFinding(finding));
    }

    lines.push('');
  }

  lines.push(`${totals.error} errors, ${totals.slop} slop, ${totals.note} notes`);
  return lines.join('\n');
}

/**
 * The reports as indented JSON.
 *
 * @param {import('./check-readmes.mjs').Report[]} reports
 * @returns {string} Without a trailing newline.
 */
export function formatJson(reports) {
  return JSON.stringify(reports, null, JSON_INDENT);
}

function formatFinding({ line, level, rule, message }) {
  const lineColumn = String(line).padStart(LINE_COLUMN_WIDTH);
  const levelColumn = level.padEnd(LEVEL_COLUMN_WIDTH);
  const ruleColumn = rule.padEnd(RULE_COLUMN_WIDTH);
  return `  ${lineColumn}  ${levelColumn}  ${ruleColumn} ${message}`;
}
