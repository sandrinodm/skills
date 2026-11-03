// Rule 1: one blank line between steps, none inside a step. Also applies the fixes for --write.

import fs from 'node:fs';
import path from 'node:path';

import {
  allComments,
  firstCommentStart,
  isBlockStatement,
  lastTokenEnd,
  leadingComment,
  usedDeclaredName,
} from './ast.mjs';
import { SCRIPT_KINDS } from './source-files.mjs';

/**
 * A rule 1 finding before it gets a file and rule, with the fix `--write` applies: 1-based lines
 * to remove, or the 1-based line to insert a blank line after. An empty fix can't be automated.
 *
 * @typedef {object} SpacingFinding
 * @property {number} line 1-based
 * @property {string} id
 * @property {string} message
 * @property {{ remove?: number[], insertAfter?: number }} fix
 */
/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
/** @typedef {import('./source-files.mjs').ParsedFile} ParsedFile */
const BLANK_LINE = /\n[ \t]*\r?\n/;
const BLANK_AFTER_OPEN = /^[ \t]*\r?\n[ \t]*\r?\n/;
const BLANK_BEFORE_CLOSE = /\n[ \t]*\r?\n[ \t]*$/;
/**
 * Rule 1: a blank line between a value and the statement that uses it, or between a comment and its
 * code; a missing blank line after a closed block; blank lines at the start or end of a block or
 * class body; two blank lines in a row. Each finding carries the `fix` that `fixSpacing` applies
 * (empty when it can't be fixed automatically).
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @returns {SpacingFinding[]}
 */
export function spacingFindings(ts, file) {
  const context = { ts, file, findings: [] };

  const visit = (node) => {
    if (ts.isBlock(node) || ts.isModuleBlock(node)) {
      checkStatementSpacing(context, node.statements, false);
      checkBlockEdges(context, node, node.statements);
    } else if (ts.isClassLike(node)) {
      checkBlockEdges(context, node, node.members);
    } else if (ts.isCaseClause(node) || ts.isDefaultClause(node)) {
      checkStatementSpacing(context, node.statements, false);
    }

    ts.forEachChild(node, visit);
  };

  checkStatementSpacing(context, file.source.statements, true);
  ts.forEachChild(file.source, visit);
  context.findings.push(...doubleBlankLines(ts, file));

  return context.findings;
}

// The spacing between consecutive statements: a comment and its code, a value and its use, and
// the blank line a closed block needs. At module level only a detached doc comment counts, since
// constants sit apart from the functions that use them on purpose.
function checkStatementSpacing(context, statements, isModule) {
  const { ts, file } = context;
  const { text, source } = file;

  for (const [index, statement] of statements.entries()) {
    const start = statement.getStart(source);
    const comment = leadingComment(ts, text, statement);
    const previous = statements[index - 1];

    const isDetachedDoc = text.startsWith('/**', comment?.pos ?? -1) && index > 0;
    const commentApplies = comment && (!isModule || isDetachedDoc);
    if (commentApplies && BLANK_LINE.test(text.slice(comment.end, start))) {
      const message = 'blank line between a comment and its code';
      reportBlankLines(context, { id: 'comment-gap', from: comment.end, to: start, message });
    }

    // A comment between a value and its use belongs with both: `const x = …;`, the comment,
    // then the `if` that checks `x`.
    if (previous && !isModule && ts.isVariableStatement(previous)) {
      const group = declarationGroup(ts, text, statements, index - 1);
      const nextStart = comment ? firstCommentStart(ts, text, statement) : start;
      checkSplitStep(context, group, statement, nextStart);
    }

    if (previous && isBlockStatement(ts, previous)) {
      checkBlankAfterBlock(context, previous, comment ? comment.pos : start);
    }
  }
}

// Reports a blank line between a declaration and the statement that uses it. `group` ends with the
// declaration right above the blank line. An earlier one counts only when the statement is an `if`
// and no later line of the run reads it: `days` and `hours` are values the condition picks
// from, while `options` that `ts` and `files` are built from starts a setup paragraph, and so
// does a run of service lookups (`const orders = yield* Orders;` …) followed by the work.
function checkSplitStep(context, group, statement, nextStart) {
  const { ts, file } = context;
  const last = group.at(-1);
  if (!BLANK_LINE.test(file.text.slice(last.end, nextStart))) {
    return;
  }

  const candidates = ts.isIfStatement(statement)
    ? group.filter((declaration, index) => !readByLater(ts, declaration, group.slice(index + 1)))
    : [last];
  const used = candidates
    .map((declaration) => usedDeclaredName(ts, declaration, statement))
    .find(Boolean);
  if (used) {
    const message = `blank line between \`${used}\` and the statement that uses it`;
    reportBlankLines(context, { id: 'split-step', from: last.end, to: nextStart, message });
  }
}

function readByLater(ts, declaration, later) {
  return later.some((statement) => usedDeclaredName(ts, declaration, statement));
}

// The run of variable statements that ends at `index`, with no blank line inside it. Declarations
// written together prepare one step, so a use of any of them belongs to that step:
// `const days = …; const hours = …;`, then `if (days > 0)`.
function declarationGroup(ts, text, statements, index) {
  const group = [statements[index]];

  for (let earlier = index - 1; earlier >= 0; earlier--) {
    const candidate = statements[earlier];
    const between = text.slice(candidate.end, group[0].getStart());
    if (!ts.isVariableStatement(candidate) || BLANK_LINE.test(between)) {
      break;
    }

    group.unshift(candidate);
  }

  return group;
}

function checkBlankAfterBlock(context, block, nextStart) {
  const { file } = context;
  if (BLANK_LINE.test(file.text.slice(block.end, nextStart))) {
    return;
  }

  // When the next statement starts on the block's closing line, a blank line can't be inserted
  // between them without moving code, so this is reported without an automatic fix.
  const closingLine = file.lineOf(block.end) + 1;
  const sharesLine = file.lineOf(nextStart) + 1 === closingLine;
  context.findings.push({
    line: closingLine,
    id: 'missing-blank-after-block',
    message: sharesLine
      ? 'more code on the closing line of a block; start it on its own line after a blank line'
      : 'no blank line after a closed block that more code follows',
    fix: sharesLine ? {} : { insertAfter: closingLine },
  });
}

// A blank line right after a block's `{` or right before its `}`, for statement blocks and class
// bodies. An empty block with only blank lines inside counts too.
function checkBlockEdges(context, node, items) {
  const { ts, file } = context;
  const open = openBracePosition(ts, file, node);
  if (open === null) {
    return;
  }

  const close = node.getEnd() - 1;
  const inside = file.text.slice(open, close);
  if (items.length === 0 && inside.trim() === '') {
    if (BLANK_LINE.test(inside)) {
      reportBlankLines(context, {
        id: 'blank-at-block-start',
        from: open,
        to: close,
        message: 'blank line inside an empty block',
      });
    }

    return;
  }

  const { firstStart, lastEnd } = contentBounds(ts, file.text, open, items);

  if (BLANK_AFTER_OPEN.test(file.text.slice(open))) {
    reportBlankLines(context, {
      id: 'blank-at-block-start',
      from: open,
      to: firstStart,
      message: 'blank line at the start of a block',
    });
  }

  if (BLANK_BEFORE_CLOSE.test(file.text.slice(lastEnd, close))) {
    reportBlankLines(context, {
      id: 'blank-at-block-end',
      from: lastEnd,
      to: close,
      message: 'blank line at the end of a block',
    });
  }
}

// The position just after a block's `{`. A class body's brace is a token of the class, found
// among its children; null when there is none (a class written without a body can't parse).
function openBracePosition(ts, file, node) {
  if (ts.isBlock(node) || ts.isModuleBlock(node)) {
    return node.getStart(file.source) + 1;
  }

  const brace = node
    .getChildren(file.source)
    .find((child) => child.kind === ts.SyntaxKind.OpenBraceToken);
  return brace ? brace.getStart(file.source) + 1 : null;
}

// Where a block's content starts and ends. With no statements or members, the comments inside are
// the content.
function contentBounds(ts, text, open, items) {
  if (items.length > 0) {
    return {
      firstStart: firstCommentStart(ts, text, items[0]),
      lastEnd: lastTokenEnd(ts, text, items.at(-1)),
    };
  }

  const comments = ts.getLeadingCommentRanges(text, open) ?? [];
  return { firstStart: comments[0].pos, lastEnd: comments.at(-1).end };
}

// Records the blank lines between two positions as one finding whose fix removes them.
function reportBlankLines(context, { id, from, to, message }) {
  const blankLines = blankLinesBetween(context.file, from, to);
  if (blankLines.length > 0) {
    context.findings.push({ line: blankLines[0], id, message, fix: { remove: blankLines } });
  }
}

function blankLinesBetween(file, from, to) {
  const blanks = [];

  for (let line = file.lineOf(from) + 1; line < file.lineOf(to); line++) {
    if (file.lines[line].trim() === '') {
      blanks.push(line + 1);
    }
  }

  return blanks;
}

// Two blank lines in a row, outside template literals.
function doubleBlankLines(ts, file) {
  const inTemplate = protectedBoundaries(ts, file);
  const findings = [];

  for (let line = 1; line < file.lines.length; line++) {
    const isDouble = file.lines[line].trim() === '' && file.lines[line - 1].trim() === '';
    if (isDouble && !inTemplate.has(line - 1) && line < file.lines.length - 1) {
      findings.push({
        line: line + 1,
        id: 'double-blank',
        message: 'two blank lines in a row',
        fix: { remove: [line + 1] },
      });
    }
  }

  return findings;
}

// The 0-based lines that a template literal or a block comment continues past. Inserting or
// removing a line right after one of them would change the literal or the comment's text.
function protectedBoundaries(ts, file) {
  const boundaries = new Set();

  const protect = (start, end) => {
    for (let line = file.lineOf(start); line < file.lineOf(end); line++) {
      boundaries.add(line);
    }
  };

  const visit = (node) => {
    if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      protect(node.getStart(file.source), node.getEnd());
    }

    ts.forEachChild(node, visit);
  };
  visit(file.source);

  for (const comment of allComments(ts, file)) {
    protect(comment.pos, comment.end);
  }

  return boundaries;
}

/**
 * Applies the rule 1 fixes to a file and saves it: removes the reported blank lines and inserts the
 * missing ones, using the file's line ending. Skips any change that would alter a template literal
 * or a comment, and doesn't save when the result has more syntax errors than the original.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @returns {boolean} true when the file was written
 */
export function fixSpacing(ts, file) {
  const { remove, insertAfter } = safeFixes(ts, file);
  if (remove.size === 0 && insertAfter.size === 0) {
    return false;
  }

  const fixedText = applyLineFixes(file, remove, insertAfter);
  // Never save a fix that leaves the file with more syntax errors than it had.
  if (syntaxErrorCount(ts, file.path, fixedText) > syntaxErrorCount(ts, file.path, file.text)) {
    console.error(`style-check: not writing ${file.path}; the spacing fix would break its syntax`);
    return false;
  }

  fs.writeFileSync(file.path, fixedText);

  return true;
}

// The 1-based lines to remove and to insert a blank line after, minus any change that would land
// inside a template literal or a comment.
function safeFixes(ts, file) {
  const findings = spacingFindings(ts, file);
  const boundaries = protectedBoundaries(ts, file);
  const remove = new Set(findings.flatMap(({ fix }) => fix.remove ?? []));
  const insertAfter = new Set(findings.map(({ fix }) => fix.insertAfter).filter(Boolean));
  // `boundaries` holds 0-based lines a literal or comment continues past. Inserting after 1-based
  // line L touches the boundary after 0-based L - 1; removing line L touches the one after L - 2.
  for (const line of insertAfter) {
    if (boundaries.has(line - 1)) {
      insertAfter.delete(line);
    }
  }

  for (const line of remove) {
    if (boundaries.has(line - 2)) {
      remove.delete(line);
    }
  }

  return { remove, insertAfter };
}

function applyLineFixes(file, remove, insertAfter) {
  const output = [];

  for (const [index, line] of file.lines.entries()) {
    if (!remove.has(index + 1)) {
      output.push(line);
    }

    if (insertAfter.has(index + 1)) {
      output.push(file.eol);
    }
  }

  return output.join('\n');
}

function syntaxErrorCount(ts, fileName, text) {
  const kind = ts.ScriptKind[SCRIPT_KINDS[path.extname(fileName)] ?? 'TS'];
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, kind);
  return source.parseDiagnostics?.length ?? 0;
}
