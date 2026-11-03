// What a check reports: one finding per problem, with a level that depends only on the rule.

/**
 * @typedef {'error' | 'slop' | 'note'} Level
 * @typedef {{ line: number, level: Level, rule: string, message: string }} Finding
 * @typedef {(line: number, rule: string, message: string) => void} AddFinding
 */

/**
 * The level of every rule the checker reports. `error` is something a reader will trip over,
 * `slop` a habit that makes the README read as generated, `note` something worth a look.
 *
 * @type {Readonly<Record<string, Level>>}
 */
export const RULE_LEVELS = Object.freeze({
  'multiple-h1': 'note',
  'emoji-heading': 'slop',
  'title-case-heading': 'note',
  'closing-summary': 'slop',
  'short-toc': 'note',
  'slop-word': 'slop',
  'slop-phrase': 'slop',
  placeholder: 'error',
  'template-boilerplate': 'error',
  'em-dashes': 'slop',
  'bold-label-list': 'slop',
  'emoji-bullets': 'slop',
  'badge-wall': 'slop',
  'static-status-badge': 'slop',
  'vanity-badge': 'slop',
  'rule-overuse': 'slop',
  'late-example': 'note',
  'empty-contributing': 'slop',
  'broken-anchor': 'error',
  'broken-link': 'error',
  'missing-target': 'error',
  'missing-dir': 'error',
  'missing-file': 'error',
  'missing-script': 'error',
  'missing-task': 'error',
  'missing-workspace': 'error',
  'badge-wrong-package': 'error',
  'no-npm-badge': 'note',
  'missing-workflow': 'error',
  'badge-wrong-repo': 'error',
  'license-mismatch': 'error',
  'missing-license-file': 'note',
  'wrong-package-name': 'error',
  'private-install': 'error',
  'no-install': 'note',
  'false-claim': 'error',
  'missing-export': 'error',
  'npm-filter': 'error',
  'wrong-package-manager': 'error',
  'wrong-port': 'error',
  'env-not-documented': 'note',
  'copied-sentence': 'note',
});

/**
 * Builds a finding for a rule, taking its level from `RULE_LEVELS`.
 *
 * @param {number} line 1-based line in the README.
 * @param {string} rule A key of `RULE_LEVELS`.
 * @param {string} message What is wrong and what to do about it.
 * @returns {Finding}
 * @throws {Error} When the rule isn't in `RULE_LEVELS`, which is a bug in a check.
 */
export function createFinding(line, rule, message) {
  const level = RULE_LEVELS[rule];
  if (level === undefined) {
    throw new Error(`unknown rule "${rule}"`);
  }

  return { line, level, rule, message };
}

/**
 * Collects the findings for one README. Checks call `add`; `unique` returns them without
 * duplicates (same line, rule and message), sorted by line. Findings on the same line keep the
 * order the checks added them in.
 *
 * @returns {{ add: AddFinding, unique: () => Finding[] }}
 */
export function createFindingList() {
  const findings = [];
  const add = (line, rule, message) => {
    findings.push(createFinding(line, rule, message));
  };
  const unique = () => {
    // A Map keeps the position of a key's first finding, so the sort below stays stable.
    const byKey = new Map(findings.map((finding) => [findingKey(finding), finding]));
    return [...byKey.values()].sort(byLine);
  };
  return { add, unique };
}

/**
 * Orders findings by line, for `Array.prototype.sort`.
 *
 * @param {Finding} a
 * @param {Finding} b
 * @returns {number} Negative when `a` comes first.
 */
export function byLine(a, b) {
  return a.line - b.line;
}

/**
 * True when a finding should fail the run: every error and slop finding, never a note.
 *
 * @param {Finding} finding
 * @returns {boolean}
 */
export function isFailure(finding) {
  return finding.level !== 'note';
}

function findingKey(finding) {
  return `${finding.line}:${finding.rule}:${finding.message}`;
}
