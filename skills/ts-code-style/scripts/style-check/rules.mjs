// The rule ids findings use, and the shape of a finding.

/**
 * A problem found in a file.
 *
 * @typedef {object} Finding
 * @property {string} file the path as given on the command line
 * @property {number} line 1-based
 * @property {string} rule a key of RULE_NAMES
 * @property {string} id a short kebab-case name for the check, such as `split-step`
 * @property {'error' | 'review'} level `error` breaks a rule; `review` needs a person to judge
 * @property {string} message what is wrong and what to do about it
 * @property {'api' | 'files'} [scope] set when the fix changes a type or signature, or moves files
 */

/**
 * What a check reports about a node; the position becomes the finding's file and line.
 *
 * @typedef {Omit<Finding, 'file' | 'line'>} FindingDetails
 */

/**
 * Records a finding at a node, or at a text position.
 *
 * @typedef {(at: import('typescript').Node | number, details: FindingDetails) => void} AddFinding
 */

/** The rules findings are filed under, with the names the summary prints. */
export const RULE_NAMES = {
  1: 'spacing',
  2: 'named constants',
  3: 'one home for errors',
  4: 'short functions',
  5: 'ternaries and braces',
  6: 'long conditions',
  7: 'options objects',
  9: 'pipelines and Effect',
  10: 'comments',
  11: 'line width',
  types: 'types',
  files: 'files and imports',
};
