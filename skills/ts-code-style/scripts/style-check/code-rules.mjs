// Rules 2, 4, 5, 6, 7 and 9: named constants, short functions, ternaries and braces, long
// conditions, options objects, and Effect code.

import {
  ERROR_CONSTRUCTOR,
  bindingNames,
  containsNode,
  enclosingFunction,
  insideEffectGenerator,
  isExported,
  isFunctionLike,
  isLoop,
  unwrap,
  unwrapParent,
  unwrapValue,
} from './ast.mjs';

/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
/** @typedef {import('./source-files.mjs').ParsedFile} ParsedFile */
/** @typedef {import('./rules.mjs').AddFinding} AddFinding */
const SCREAMING_SNAKE = /^[A-Z][A-Z0-9_]*$/;
// `parseInt(text, radix)` takes the radix second; `n.toString(radix)` takes it first.
const PARSE_INT_CALLEE = /parseInt$/;
const RADIX_CALLEE = /(?:^|\.)parseInt$|\.toString$/;
const STATUS_PROPERTY = /^(status|statusCode)$/;
const STATUS_CALLEE = /\.status$/;
const ALLOWED_NUMBERS = new Set([0, 1, 2]);
const MAX_FUNCTION_LINES = 40;
const MAX_NESTING_DEPTH = 3;
const MAX_CONDITION_OPERANDS = 3;
const MAX_OPTIONAL_PARAMETERS = 2;
const MAX_CONDITIONAL_SPREADS = 2;
const HTTP_STATUS_MIN = 100;
const HTTP_STATUS_MAX = 599;
// Test assertions take `undefined` as an expected value, not to skip a parameter.
const ASSERTION_METHODS = [
  'equal',
  'strictEqual',
  'deepEqual',
  'deepStrictEqual',
  'notEqual',
  'is',
  'toBe',
  'toEqual',
  'toStrictEqual',
];
const ASSERTION_CALLEE = new RegExp(
  String.raw`^(?:assert|expect)\b|\.(?:${ASSERTION_METHODS.join('|')})$`,
);
/**
 * Rule 2: a number other than 0, 1 and 2 in a function body that isn't the value of a
 * SCREAMING_SNAKE constant, an HTTP status in an error or response, or a radix; and a module-level
 * `const` holding a number under a camelCase name.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {import("typescript").NumericLiteral} node
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkMagicNumber(ts, file, node, add) {
  const value = Number(node.text);
  const parent = node.parent;

  if (file.isTest || ALLOWED_NUMBERS.has(value)) {
    return;
  }

  if (!enclosingFunction(ts, node)) {
    checkModuleNumber(ts, node, add);
    return;
  }

  if (
    ts.isLiteralTypeNode(parent) ||
    ts.isElementAccessExpression(parent) ||
    ts.isEnumMember(parent)
  ) {
    return;
  }

  const declaration = constantDeclaration(ts, node);
  if (declaration && SCREAMING_SNAKE.test(declaration.name.text)) {
    return;
  }

  if (isRadixArgument(ts, node) || isStatusCode(ts, node)) {
    return;
  }

  add(node, {
    rule: '2',
    id: 'magic-number',
    level: 'review',
    message: `${node.text} in a function body; name it as a constant with units`,
  });
}

// A module-level `const delayMs = 60000;` is a constant without a constant's name.
function checkModuleNumber(ts, node, add) {
  const declaration = constantDeclaration(ts, node);
  const isDirectValue = declaration && unwrapValue(ts, declaration.initializer) === node;
  const isConst = Boolean(declaration) && (declaration.parent.flags & ts.NodeFlags.Const) !== 0;
  if (isDirectValue && isConst && !SCREAMING_SNAKE.test(declaration.name.text)) {
    const assignment = `${declaration.name.text} = ${node.text}`;
    const message = `\`${assignment}\` is a constant; name it in SCREAMING_SNAKE with units`;
    add(node, { rule: '2', id: 'magic-number', level: 'review', message });
  }
}

// The declaration a literal is the value of: directly, or inside an array or object literal (not
// inside a function or call). `const LIMITS = { max: 50 }` counts; `const F = () => retry(99)`
// doesn't.
function constantDeclaration(ts, node) {
  let current = node;
  while (
    ts.isPrefixUnaryExpression(current.parent) ||
    ts.isParenthesizedExpression(current.parent) ||
    ts.isArrayLiteralExpression(current.parent) ||
    ts.isObjectLiteralExpression(current.parent) ||
    ts.isPropertyAssignment(current.parent) ||
    ts.isAsExpression(current.parent) ||
    ts.isSatisfiesExpression(current.parent)
  ) {
    current = current.parent;
  }

  const parent = current.parent;
  return ts.isVariableDeclaration(parent) &&
    parent.initializer === current &&
    ts.isIdentifier(parent.name)
    ? parent
    : null;
}

// An HTTP status passed to an error constructor or set as `status`/`statusCode` already has a
// home: the error factory or the response it builds.
function isStatusCode(ts, node) {
  const value = Number(node.text);
  const parent = node.parent;

  if (!Number.isInteger(value) || value < HTTP_STATUS_MIN || value > HTTP_STATUS_MAX) {
    return false;
  }

  const isErrorArgument =
    ts.isNewExpression(parent) && ERROR_CONSTRUCTOR.test(parent.expression.getText());
  const isStatusProperty =
    ts.isPropertyAssignment(parent) && STATUS_PROPERTY.test(parent.name.getText());
  const isStatusCall =
    ts.isCallExpression(parent) && STATUS_CALLEE.test(parent.expression.getText());
  return isErrorArgument || isStatusProperty || isStatusCall;
}

// `parseInt(value, 10)` and `n.toString(16)` take a radix, which is not a magic number.
function isRadixArgument(ts, node) {
  const call = node.parent;
  if (!ts.isCallExpression(call)) {
    return false;
  }

  const callee = call.expression.getText();
  const radixIndex = PARSE_INT_CALLEE.test(callee) ? 1 : 0;
  return RADIX_CALLEE.test(callee) && call.arguments[radixIndex] === node;
}

/**
 * Rule 5: a ternary with another ternary inside it, outside nested functions. Reported once, on the
 * outermost one.
 *
 * @param {TypeScript} ts
 * @param {import("typescript").ConditionalExpression} node
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkTernary(ts, node, add) {
  const parent = unwrapParent(ts, node);
  if (ts.isConditionalExpression(parent)) {
    return;
  }

  const hasNested = [node.condition, node.whenTrue, node.whenFalse].some((part) =>
    containsNode(ts, part, ts.isConditionalExpression),
  );
  if (hasNested) {
    add(node, {
      rule: '5',
      id: 'nested-ternary',
      level: 'error',
      message: 'nested ternary; use a small function with early returns',
    });
  }
}

/**
 * Rule 5 braces for the `if` and `else` bodies, and rule 6: a condition with more than
 * MAX_CONDITION_OPERANDS operands.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {import("typescript").IfStatement} node
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkIf(ts, file, node, add) {
  checkBody(ts, file, node.thenStatement, '`if`', add);

  if (node.elseStatement && !ts.isIfStatement(node.elseStatement)) {
    checkBody(ts, file, node.elseStatement, '`else`', add);
  }

  const operands = logicalOperands(ts, node.expression);
  if (operands > MAX_CONDITION_OPERANDS) {
    add(node.expression, {
      rule: '6',
      id: 'long-condition',
      level: 'review',
      message: `condition with ${operands} operands; turn it into a list of named checks`,
    });
  }
}

/**
 * Rule 5: a body needs braces, and its first statement goes on its own line; `if (ready) { work();
 * }` breaks the rule as much as `if (ready) work();`.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {import("typescript").Statement} body
 * @param {string} label how the message names the body: `` `if` ``, `` `else` `` or `loop`
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkBody(ts, file, body, label, add) {
  if (!ts.isBlock(body)) {
    add(body, {
      rule: '5',
      id: 'unbraced-body',
      level: 'error',
      message: `${label} body without braces`,
    });
    return;
  }

  const first = body.statements[0];
  if (
    first &&
    file.lineOf(first.getStart(file.source)) === file.lineOf(body.getStart(file.source))
  ) {
    add(first, {
      rule: '5',
      id: 'same-line-body',
      level: 'error',
      message: `${label} body on the same line as its \`{\`; put it on its own line`,
    });
  }
}

function logicalOperands(ts, node) {
  const inner = unwrap(ts, node);
  const isLogical =
    ts.isBinaryExpression(inner) &&
    (inner.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      inner.operatorToken.kind === ts.SyntaxKind.BarBarToken);
  return isLogical ? logicalOperands(ts, inner.left) + logicalOperands(ts, inner.right) : 1;
}

/**
 * Rule 5: more than MAX_CONDITIONAL_SPREADS conditional spreads (`...(x ? {…} : {})`, `...(x &&
 * {…})`) in one object literal.
 *
 * @param {TypeScript} ts
 * @param {import("typescript").ObjectLiteralExpression} node
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkConditionalSpreads(ts, node, add) {
  const conditional = node.properties.filter((property) => {
    if (!ts.isSpreadAssignment(property)) {
      return false;
    }

    const value = unwrap(ts, property.expression);
    return (
      ts.isConditionalExpression(value) ||
      (ts.isBinaryExpression(value) &&
        value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
    );
  });
  if (conditional.length > MAX_CONDITIONAL_SPREADS) {
    add(node, {
      rule: '5',
      id: 'conditional-spreads',
      level: 'review',
      message:
        `${conditional.length} conditional spreads in one object; ` + 'build that part in a helper',
    });
  }
}

/**
 * Rule 7: `undefined` passed to reach a later argument (outside test assertions); rule 9: `console`
 * inside `Effect.gen`.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {import("typescript").CallExpression} node
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkCall(ts, file, node, add) {
  const args = node.arguments;
  const skipped = args.findIndex((arg, index) => index < args.length - 1 && isUndefined(ts, arg));
  const isAssertion = ASSERTION_CALLEE.test(node.expression.getText());
  if (skipped !== -1 && !isAssertion) {
    add(args[skipped], {
      rule: '7',
      id: 'positional-undefined',
      level: 'review',
      message: 'passes `undefined` to reach a later argument; use an options object',
    });
  }

  const callee = node.expression;
  const isConsole =
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === 'console';
  if (isConsole && file.usesEffect && insideEffectGenerator(ts, node)) {
    add(node, {
      rule: '9',
      id: 'console-in-effect',
      level: 'error',
      message: `console.${callee.name.text} in Effect code; use Effect.log*`,
    });
  }
}

function isUndefined(ts, node) {
  return (
    (ts.isIdentifier(node) && node.text === 'undefined') ||
    (ts.isVoidExpression(node) && ts.isNumericLiteral(node.expression))
  );
}

/**
 * Rule 7: more than MAX_OPTIONAL_PARAMETERS optional parameters (tagged `api` when the signature is
 * public); rule 4: a body longer than MAX_FUNCTION_LINES lines or nested more than
 * MAX_NESTING_DEPTH deep. Test files skip the rule 4 checks.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {import("typescript").FunctionLikeDeclaration} node
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkFunction(ts, file, node, add) {
  const optional = node.parameters.filter(
    (parameter) => parameter.questionToken || parameter.initializer,
  );
  if (optional.length > MAX_OPTIONAL_PARAMETERS) {
    const message = `${optional.length} optional parameters; take an options object`;
    add(node, {
      rule: '7',
      id: 'optional-parameters',
      level: 'review',
      message,
      scope: isPublicSignature(ts, file, node) ? 'api' : undefined,
    });
  }

  if (file.isTest || !node.body || !ts.isBlock(node.body)) {
    return;
  }

  const lines = file.lineOf(node.body.getEnd()) - file.lineOf(node.body.getStart(file.source)) - 1;
  if (lines > MAX_FUNCTION_LINES) {
    add(node, {
      rule: '4',
      id: 'long-function',
      level: 'review',
      message: `${lines}-line function body; split it into named steps`,
    });
  }

  const depth = nestingDepth(ts, node.body, 0);
  if (depth > MAX_NESTING_DEPTH) {
    add(node, {
      rule: '4',
      id: 'deep-nesting',
      level: 'review',
      message: `control flow nested ${depth} deep; use early returns or extract a step`,
    });
  }
}

// True for exported functions, functions assigned to an exported `const`, and the non-private
// methods of an exported class: changing their parameters changes the module's API.
function isPublicSignature(ts, file, node) {
  if (ts.isFunctionDeclaration(node)) {
    return isExported(ts, file, node);
  }

  if (ts.isExportAssignment(node.parent)) {
    return true;
  }

  const declaration = ts.isVariableDeclaration(node.parent) ? node.parent : null;
  if (declaration) {
    const names = bindingNames(ts, declaration.name);
    const statement = declaration.parent.parent;
    const exportsAll = ts
      .getModifiers(statement)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    return (
      ts.isSourceFile(statement.parent) &&
      (exportsAll || names.some((name) => file.localExports.has(name)))
    );
  }

  if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)) {
    const isPrivate =
      ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword) ||
      ts.isPrivateIdentifier(node.name ?? {});
    return !isPrivate && ts.isClassDeclaration(node.parent) && isExported(ts, file, node.parent);
  }

  return false;
}

function nestingDepth(ts, node, depth) {
  let deepest = depth;

  ts.forEachChild(node, (child) => {
    if (isFunctionLike(ts, child)) {
      return;
    }

    const isElseIf =
      ts.isIfStatement(child) &&
      ts.isIfStatement(child.parent) &&
      child.parent.elseStatement === child;
    const nests =
      !isElseIf &&
      (ts.isIfStatement(child) ||
        isLoop(ts, child) ||
        ts.isSwitchStatement(child) ||
        ts.isTryStatement(child));
    deepest = Math.max(deepest, nestingDepth(ts, child, nests ? depth + 1 : depth));
  });

  return deepest;
}
