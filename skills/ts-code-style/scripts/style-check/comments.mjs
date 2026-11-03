// Rule 10: banner and separator comments, and comments about plans, tickets and history.

import { allComments } from './ast.mjs';

/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
/** @typedef {import('./source-files.mjs').ParsedFile} ParsedFile */
/** @typedef {import('./rules.mjs').AddFinding} AddFinding */
const COMMENT_DELIMITERS = /^\/\/+|^\/\*+|\*+\/$/g;
const DOC_LINE_PREFIX = /^\s*\*\s?/;
const TOOL_DIRECTIVE = /^\/\/\s*@ts-|eslint|oxlint|prettier-ignore|biome-ignore/;
const BANNER_COMMENT =
  /^\s*(?:[-=*#~_+/]{3,}|[─━═▬■]{2,}|#?region\b|#?endregion\b|.*\s(?:[-=*#~_]{4,}|[─━═]{2,})\s*$)/i;
// Phrases that describe how the code got here instead of what it does.
const HISTORY_PHRASES = [
  String.raw`\b(?:phase|milestone)\s+\d+\b`,
  String.raw`\bstep\s+\d+\s+of\b`,
  String.raw`\bno longer\b`,
  String.raw`\bnow (?:uses|returns|we|calls)\b`,
  String.raw`\bthis (?:pr|refactor|commit)\b`,
  String.raw`\b(?:per|in|from|following) (?:the|our) plan\b`,
  String.raw`\bplan (?:step|item|phase)\b`,
  String.raw`\bas discussed\b`,
];
const HISTORY_COMMENT = new RegExp(HISTORY_PHRASES.join('|'), 'i');
// Standards whose names look like ticket ids (UTF-8, SHA-256, ISO-8601).
const STANDARD_PREFIXES = [
  'UTF',
  'ISO',
  'SHA',
  'AES',
  'RFC',
  'HTTP',
  'TLS',
  'ES',
  'ECMA',
  'CVE',
  'RSA',
  'HS',
  'RS',
  'PS',
  'EC',
  'PEM',
  'DER',
  'IEEE',
  'ANSI',
  'UTC',
  'GMT',
];
const TICKET_ID = new RegExp(
  String.raw`\b(?!(?:${STANDARD_PREFIXES.join('|')})-)[A-Z][A-Z0-9]{1,9}-\d{2,}\b`,
);
/**
 * Rule 10: banner and separator comments, and comments that refer to a plan, ticket or the code's
 * history. Deprecation notes and tool directives are skipped.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkComments(ts, file, add) {
  for (const comment of allComments(ts, file)) {
    const raw = file.text.slice(comment.pos, comment.end);
    const body = raw.replace(COMMENT_DELIMITERS, '');

    if (raw.includes('@deprecated') || TOOL_DIRECTIVE.test(raw)) {
      continue;
    }

    const lines = body.split('\n').map((line) => line.replace(DOC_LINE_PREFIX, ''));
    if (lines.some((line) => BANNER_COMMENT.test(line))) {
      add(comment.pos, {
        rule: '10',
        id: 'banner-comment',
        level: 'error',
        message: 'banner or separator comment; split the file instead',
      });
    }

    const history = body.match(HISTORY_COMMENT) ?? body.match(TICKET_ID);
    if (history) {
      add(comment.pos, {
        rule: '10',
        id: 'history-comment',
        level: 'error',
        message:
          `refers to a plan, ticket or history ("${history[0]}"); ` + 'describe the code as it is',
      });
    }
  }
}
