// Runs the per-file checks on one parsed file.

import {
  enclosingFunction,
  insideEffectGenerator,
  isFunctionLike,
  isLoop,
  unwrap,
} from './ast.mjs';
import {
  checkBody,
  checkCall,
  checkConditionalSpreads,
  checkFunction,
  checkIf,
  checkMagicNumber,
  checkTernary,
} from './code-rules.mjs';
import { checkComments } from './comments.mjs';
import { checkFileName, checkImports, checkLineWidth } from './layout.mjs';
import { spacingFindings } from './spacing.mjs';
import { checkExport, checkTypes } from './types.mjs';

/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
/** @typedef {import('./source-files.mjs').ParsedFile} ParsedFile */

/** @typedef {import('./rules.mjs').Finding} Finding */

/**
 * Runs every per-file check (rules 1, 2, 4 to 7, 9 to 11, the type rules and the file rules) and
 * returns the findings with 1-based line numbers. Cross-file checks run separately.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {{ width: number }} options the line-width limit, 0 to skip it
 * @returns {Finding[]}
 */
export function checkFile(ts, file, options) {
  const findings = [];

  const add = (node, { rule, id, level, message, scope }) => {
    const position = typeof node === 'number' ? node : node.getStart(file.source);
    findings.push({
      file: file.path,
      line: file.lineOf(position) + 1,
      rule,
      id,
      level,
      message,
      ...(scope ? { scope } : {}),
    });
  };

  for (const { fix, ...finding } of spacingFindings(ts, file)) {
    findings.push({ file: file.path, rule: '1', level: 'error', ...finding });
  }

  checkComments(ts, file, add);
  checkFileName(file, add);
  checkImports(ts, file, add);
  checkLineWidth(file, options.width, findings);

  const visit = (node) => {
    checkNode(ts, file, node, add);
    ts.forEachChild(node, visit);
  };
  visit(file.source);

  return findings;
}

// The node-level checks for rules 2 to 10 and the type rules.
function checkNode(ts, file, node, add) {
  if (ts.isNumericLiteral(node)) {
    checkMagicNumber(ts, file, node, add);
  } else if (ts.isRegularExpressionLiteral(node) && !file.isTest && enclosingFunction(ts, node)) {
    add(node, {
      rule: '2',
      id: 'inline-regex',
      level: 'review',
      message: 'regex literal inside a function; name it as a module constant',
    });
  } else if (ts.isConditionalExpression(node)) {
    checkTernary(ts, node, add);
  } else if (ts.isIfStatement(node)) {
    checkIf(ts, file, node, add);
  } else if (isLoop(ts, node)) {
    checkBody(ts, file, node.statement, 'loop', add);
  } else if (ts.isObjectLiteralExpression(node)) {
    checkConditionalSpreads(ts, node, add);
  } else if (ts.isCallExpression(node)) {
    checkCall(ts, file, node, add);
  } else if (ts.isPropertyAccessExpression(node) && node.name.text === 'pipe') {
    if (ts.isConditionalExpression(unwrap(ts, node.expression))) {
      add(node, {
        rule: '9',
        id: 'pipe-off-ternary',
        level: 'error',
        message: 'pipes off a ternary; name each branch first',
      });
    }
  } else if (ts.isExportAssignment(node) && !file.isTest) {
    checkExport(ts, file, node, add);
  } else if (ts.isThrowStatement(node) && file.usesEffect && insideEffectGenerator(ts, node)) {
    add(node, {
      rule: '9',
      id: 'throw-in-effect',
      level: 'error',
      message: 'throw inside Effect.gen; fail with a tagged error',
    });
  }

  if (isFunctionLike(ts, node)) {
    checkFunction(ts, file, node, add);
  }

  checkTypes(ts, file, node, add);
}
