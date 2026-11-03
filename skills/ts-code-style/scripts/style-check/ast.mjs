// Small questions about TypeScript syntax trees that several checks ask: what a declaration binds,
// where a statement starts and ends, which function a node is in, whether a name is exported.

/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
/** @typedef {import('./source-files.mjs').ParsedFile} ParsedFile */
/** @typedef {import('typescript').Node} Node */

const EFFECT_GENERATOR_CALL = /\bEffect\.(gen|fn)\b/;
const EFFECT_CALL_PREVIEW_CHARS = 40;
/** Class names that look like errors: `ApiError`, `ValidationException`. */
export const ERROR_CONSTRUCTOR = /(?:Error|Exception)$/;
/**
 * The first name a declaration binds that the next statement reads in its condition, loop header,
 * value or call, outside nested functions.
 *
 * @param {TypeScript} ts
 * @param {import("typescript").VariableStatement} declaration the statement above the blank line
 * @param {Node} statement the statement below it
 * @returns {string | undefined} the name, or undefined when the statement doesn't use one
 */
export function usedDeclaredName(ts, declaration, statement) {
  const names = new Set(
    declaration.declarationList.declarations.flatMap((item) => bindingNames(ts, item.name)),
  );
  return headNodes(ts, statement)
    .map((node) => firstReference(ts, node, names))
    .find(Boolean);
}

/**
 * The comment on its own line directly above a statement. A comment at the end of the previous
 * statement's line belongs to that statement and isn't returned.
 *
 * @param {TypeScript} ts
 * @param {string} text the file text
 * @param {Node} statement
 * @returns {import("typescript").CommentRange | null}
 */
export function leadingComment(ts, text, statement) {
  const last = (ts.getLeadingCommentRanges(text, statement.getFullStart()) ?? []).at(-1);
  if (!last) {
    return null;
  }

  const lineStart = text.lastIndexOf('\n', last.pos - 1) + 1;
  return text.slice(lineStart, last.pos).trim() === '' ? last : null;
}

/**
 * Where a statement visibly starts: its first leading comment, or its first token.
 *
 * @param {TypeScript} ts
 * @param {string} text the file text
 * @param {Node} statement
 * @returns {number} a text position
 */
export function firstCommentStart(ts, text, statement) {
  const first = (ts.getLeadingCommentRanges(text, statement.getFullStart()) ?? [])[0];
  return first ? first.pos : statement.getStart();
}

/**
 * Where a statement visibly ends: after its trailing comment, or after its last token.
 *
 * @param {TypeScript} ts
 * @param {string} text the file text
 * @param {Node} statement
 * @returns {number} a text position
 */
export function lastTokenEnd(ts, text, statement) {
  const trailing = (ts.getTrailingCommentRanges(text, statement.getEnd()) ?? []).at(-1);
  return trailing ? trailing.end : statement.getEnd();
}

/**
 * True for the statements that end in a block rule 1 wants a blank line after: `if`, loops,
 * `switch` and `try`.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {boolean}
 */
export function isBlockStatement(ts, node) {
  return (
    ts.isIfStatement(node) ||
    isLoop(ts, node) ||
    ts.isSwitchStatement(node) ||
    ts.isTryStatement(node)
  );
}

/**
 * True for `for`, `for…in`, `for…of`, `while` and `do…while`.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {boolean}
 */
export function isLoop(ts, node) {
  const loopChecks = [
    ts.isForStatement,
    ts.isForInStatement,
    ts.isForOfStatement,
    ts.isWhileStatement,
    ts.isDoStatement,
  ];
  return loopChecks.some((isKind) => isKind(node));
}

/**
 * Removes the wrappers that don't change which literal a value is written as: parentheses, a
 * leading `-` or `+`, `as` and `satisfies`.
 *
 * @param {TypeScript} ts
 * @param {Node | undefined} node
 * @returns {Node | undefined}
 */
export function unwrapValue(ts, node) {
  const isWrapper =
    node &&
    (ts.isPrefixUnaryExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node));
  return isWrapper ? unwrapValue(ts, node.operand ?? node.expression) : node;
}

/**
 * True when a top-level declaration is exported, by an `export` modifier or by a later `export {
 * name }` or `export default name`.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {Node} node
 * @returns {boolean}
 */
export function isExported(ts, file, node) {
  if (!node.parent || !ts.isSourceFile(node.parent)) {
    return false;
  }

  const modifiers = ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
  if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
    return true;
  }

  return declaredNames(ts, node).some((name) => file.localExports.has(name));
}

/**
 * The names a top-level statement declares: every binding of a variable statement, or the name of a
 * function, class, type or interface.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {string[]}
 */
export function declaredNames(ts, node) {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.flatMap((declaration) =>
      bindingNames(ts, declaration.name),
    );
  }

  return node.name && ts.isIdentifier(node.name) ? [node.name.text] : [];
}

/**
 * The local names exported by `export { a, b as c }` (without a `from`) and `export default name`.
 *
 * @param {TypeScript} ts
 * @param {import("typescript").SourceFile} source
 * @returns {Set<string>}
 */
export function localExportNames(ts, source) {
  const names = new Set();

  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) {
      names.add(statement.expression.text);
    }

    const isLocalExport =
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause);
    for (const element of isLocalExport ? statement.exportClause.elements : []) {
      names.add((element.propertyName ?? element.name).text);
    }
  }

  return names;
}

/**
 * Every comment in the file once, except a shebang line.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @returns {import("typescript").CommentRange[]}
 */
export function allComments(ts, file) {
  const seen = new Map();

  const collect = (ranges) => {
    for (const range of ranges ?? []) {
      seen.set(range.pos, range);
    }
  };

  const visit = (node) => {
    collect(ts.getLeadingCommentRanges(file.text, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(file.text, node.getEnd()));
    ts.forEachChild(node, visit);
  };
  visit(file.source);
  collect(ts.getLeadingCommentRanges(file.text, file.source.endOfFileToken.getFullStart()));

  return [...seen.values()].filter((range) => !file.text.startsWith('#!', range.pos));
}

/**
 * Removes parentheses, `as` and `satisfies` around an expression.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {Node}
 */
export function unwrapExpression(ts, node) {
  const isWrapper =
    ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node);
  return isWrapper ? unwrapExpression(ts, node.expression) : node;
}

/**
 * Maps each local name an import binds to its name in the module it comes from, so `import {
 * ApiError as FirstError }` and `import { ApiError }` are recognised as one class. A default import
 * maps to `'default'`.
 *
 * @param {TypeScript} ts
 * @param {import("typescript").ImportDeclaration} declaration
 * @returns {Map<string, string>}
 */
export function importedNames(ts, declaration) {
  const clause = declaration.importClause;
  const names = new Map();
  if (clause?.name) {
    names.set(clause.name.text, 'default');
  }

  const elements =
    clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
      ? clause.namedBindings.elements
      : [];
  for (const element of elements) {
    names.set(element.name.text, (element.propertyName ?? element.name).text);
  }

  return names;
}

/**
 * True when a parameter or a local declared in an enclosing function has this identifier's name, so
 * the identifier doesn't refer to the module-level binding.
 *
 * @param {TypeScript} ts
 * @param {import("typescript").Identifier} identifier
 * @returns {boolean}
 */
export function isShadowed(ts, identifier) {
  const name = identifier.text;

  for (let scope = enclosingFunction(ts, identifier); scope; scope = enclosingFunction(ts, scope)) {
    const parameters = scope.parameters.flatMap((parameter) => bindingNames(ts, parameter.name));
    const locals =
      scope.body && ts.isBlock(scope.body)
        ? scope.body.statements.flatMap((statement) => declaredNames(ts, statement))
        : [];
    if (parameters.includes(name) || locals.includes(name)) {
      return true;
    }
  }

  return false;
}

/**
 * The value a literal stands for, so `'x'`, `"x"` and `` `x` `` compare equal. Call it only on
 * nodes `isLiteral` accepts.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {string | number}
 */
export function literalValue(ts, node) {
  if (ts.isPrefixUnaryExpression(node)) {
    return -Number(node.operand.text);
  }

  return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
}

/**
 * True for a string, number or substitution-free template literal, or a negative number.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {boolean}
 */
export function isLiteral(ts, node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    (ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(node.operand))
  );
}

/**
 * Returns every name a declaration binds: `x` in `const x = …`, and each binding in a
 * destructuring pattern (`const { a, b: c, ...rest } = …` binds `a`, `c` and `rest`).
 */
/**
 * Every name a binding introduces: `x` in `const x = …`, and each binding in a destructuring
 * pattern (`const { a, b: c, ...rest } = …` binds `a`, `c` and `rest`).
 *
 * @param {TypeScript} ts
 * @param {import("typescript").BindingName} name
 * @returns {string[]}
 */
export function bindingNames(ts, name) {
  if (ts.isIdentifier(name)) {
    return [name.text];
  }

  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(ts, element.name),
  );
}

// The parts of a statement that read values before any nested body runs.
function headNodes(ts, statement) {
  if (
    ts.isIfStatement(statement) ||
    ts.isWhileStatement(statement) ||
    ts.isDoStatement(statement)
  ) {
    return [statement.expression];
  }

  if (
    ts.isForOfStatement(statement) ||
    ts.isForInStatement(statement) ||
    ts.isSwitchStatement(statement)
  ) {
    return [statement.expression];
  }

  if (ts.isForStatement(statement)) {
    return [statement.initializer, statement.condition, statement.incrementor].filter(Boolean);
  }

  if (
    ts.isReturnStatement(statement) ||
    ts.isThrowStatement(statement) ||
    ts.isExpressionStatement(statement)
  ) {
    return statement.expression ? [statement.expression] : [];
  }

  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations
      .map((declaration) => declaration.initializer)
      .filter(Boolean);
  }

  return [];
}

// Finds a reference to one of `names`, skipping property names and nested functions.
function firstReference(ts, node, names) {
  if (ts.isIdentifier(node)) {
    const parent = node.parent;
    const isPropertyName =
      (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
      (ts.isPropertyAssignment(parent) && parent.name === node) ||
      (ts.isJsxAttribute(parent) && parent.name === node);
    return !isPropertyName && names.has(node.text) ? node.text : null;
  }

  if (isFunctionLike(ts, node)) {
    return null;
  }

  return ts.forEachChild(node, (child) => firstReference(ts, child, names)) ?? null;
}

/**
 * True for function declarations and expressions, arrow functions, methods, constructors and
 * accessors.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {boolean}
 */
export function isFunctionLike(ts, node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/**
 * The nearest function around a node, not counting the node itself.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {Node | null}
 */
export function enclosingFunction(ts, node) {
  return findAncestor(ts, node.parent, (ancestor) => isFunctionLike(ts, ancestor));
}

/**
 * True inside the generator passed to `Effect.gen` or `Effect.fn(…)`.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {boolean}
 */
export function insideEffectGenerator(ts, node) {
  const generator = findAncestor(
    ts,
    node,
    (ancestor) => ts.isFunctionExpression(ancestor) && Boolean(ancestor.asteriskToken),
  );
  return (
    Boolean(generator) &&
    EFFECT_GENERATOR_CALL.test(generator.parent.getText().slice(0, EFFECT_CALL_PREVIEW_CHARS))
  );
}

/**
 * The node itself or its nearest ancestor that matches.
 *
 * @param {TypeScript} ts
 * @param {Node | undefined} node
 * @param {(node: Node) => boolean} predicate
 * @returns {Node | null}
 */
export function findAncestor(ts, node, predicate) {
  for (let current = node; current; current = current.parent) {
    if (predicate(current)) {
      return current;
    }
  }

  return null;
}

/**
 * True when the node or a descendant outside nested functions matches.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @param {(node: Node) => boolean} predicate
 * @returns {boolean}
 */
export function containsNode(ts, node, predicate) {
  if (predicate(node)) {
    return true;
  }

  if (isFunctionLike(ts, node)) {
    return false;
  }

  return ts.forEachChild(node, (child) => containsNode(ts, child, predicate) || undefined) ?? false;
}

/**
 * Removes the parentheses around an expression.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {Node}
 */
export function unwrap(ts, node) {
  return ts.isParenthesizedExpression(node) ? unwrap(ts, node.expression) : node;
}

/**
 * The nearest ancestor that isn't a parenthesized expression.
 *
 * @param {TypeScript} ts
 * @param {Node} node
 * @returns {Node}
 */
export function unwrapParent(ts, node) {
  return ts.isParenthesizedExpression(node.parent) ? unwrapParent(ts, node.parent) : node.parent;
}
