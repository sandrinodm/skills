// The type rules and the checks on exported declarations.

import { bindingNames, findAncestor, isExported, unwrap } from './ast.mjs';

/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
/** @typedef {import('./source-files.mjs').ParsedFile} ParsedFile */
/** @typedef {import('./rules.mjs').AddFinding} AddFinding */
/** @typedef {import('typescript').Node} Node */
const JSDOC_RETURNS = /@returns?\b|@type\s*\{/;
const MAX_OPTIONAL_PROPERTIES = 3;
const OPTIONS_TYPE_NAME =
  /(?:Options|Config|Configuration|Props|Settings|Params|Parameters|Init|Overrides|Input)$/;
const ZOD_IMPORT = /^zod(?:\/.*)?$/;
/**
 * The type rules for one node: `enum`, `any`, `Function`, method shorthand, a plain `interface`,
 * `as`, Zod imports and bags of optionals; and for exported declarations, missing return types and
 * doc comments.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {Node} node
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkTypes(ts, file, node, add) {
  const finding = typeFinding(ts, file, node);
  if (finding) {
    add(node, { rule: 'types', scope: 'api', ...finding });
  }

  checkOptionalBag(ts, node, add);

  if (!file.isTest && isExported(ts, file, node)) {
    checkExport(ts, file, node, add);
  }
}

// Returns { id, level, message } when the node breaks a type rule, or null.
function typeFinding(ts, file, node) {
  if (ts.isEnumDeclaration(node)) {
    return {
      id: 'enum',
      level: 'error',
      message: 'enum; use a string-literal union or an `as const` object',
    };
  }

  if (node.kind === ts.SyntaxKind.AnyKeyword) {
    return { id: 'any', level: 'error', message: '`any`; use `unknown` and decode it' };
  }

  if (ts.isTypeReferenceNode(node) && node.typeName.getText() === 'Function') {
    return {
      id: 'function-type',
      level: 'error',
      message: 'the `Function` type; write the signature',
    };
  }

  if (ts.isMethodSignature(node)) {
    return {
      id: 'method-shorthand',
      level: 'error',
      message: 'method shorthand in a type; use a property with a function type',
    };
  }

  // `declare module` and `declare global` blocks need interfaces for declaration merging.
  const isPlainInterface =
    ts.isInterfaceDeclaration(node) &&
    !node.heritageClauses &&
    !findAncestor(ts, node, ts.isModuleDeclaration);
  if (isPlainInterface) {
    return {
      id: 'plain-interface',
      level: 'error',
      message: '`interface` without `extends`; use `type`',
    };
  }

  if (ts.isAsExpression(node) && node.type.getText() !== 'const' && !file.isTest) {
    return {
      id: 'as-assertion',
      level: 'review',
      message: '`as` assertion; prefer `satisfies` or decoding',
    };
  }

  if (ts.isImportDeclaration(node) && ZOD_IMPORT.test(node.moduleSpecifier.text)) {
    return {
      id: 'zod',
      level: 'review',
      message: 'imports Zod; use Effect Schema unless the codebase standardized on Zod',
    };
  }

  return null;
}

// A named object type with many optional properties is usually several shapes in one. Types named
// as options, props or config are option bags by design and are skipped.
function checkOptionalBag(ts, node, add) {
  const namedType = namedObjectType(ts, node);
  if (!namedType || OPTIONS_TYPE_NAME.test(namedType.name.text)) {
    return;
  }

  const optional = node.members.filter((member) => member.questionToken).length;
  if (optional > MAX_OPTIONAL_PROPERTIES) {
    const message = `${optional} optional properties; consider a discriminated union`;
    add(node, { rule: 'types', id: 'bag-of-optionals', level: 'review', message, scope: 'api' });
  }
}

// The interface or type alias that names an object type, or null for an inline type literal.
function namedObjectType(ts, node) {
  if (ts.isInterfaceDeclaration(node)) {
    return node;
  }

  if (ts.isTypeLiteralNode(node) && ts.isTypeAliasDeclaration(node.parent)) {
    return node.parent;
  }

  return null;
}

// The functions an exported statement defines: a function declaration, or the arrow functions and
// function expressions assigned in an exported `const`.
function exportedFunctions(ts, file, node) {
  if (ts.isFunctionDeclaration(node)) {
    return [node];
  }

  if (ts.isExportAssignment(node)) {
    const value = unwrap(ts, node.expression);
    return ts.isArrowFunction(value) || ts.isFunctionExpression(value) ? [value] : [];
  }

  if (!ts.isVariableStatement(node)) {
    return [];
  }

  // `export const f = …` exports every declaration; `const f = …, g = …; export { f }` only `f`.
  const exportsAll = ts
    .getModifiers(node)
    ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  return node.declarationList.declarations
    .filter(
      (declaration) =>
        exportsAll ||
        bindingNames(ts, declaration.name).some((name) => file.localExports.has(name)),
    )
    .map((declaration) => declaration.initializer)
    .filter((value) => value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value)));
}

/**
 * An exported function needs a declared return type (in JavaScript, a JSDoc `@returns` or `@type`
 * counts), and every export needs a doc comment.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile} file
 * @param {Node} node a top-level exported declaration or `export default` assignment
 * @param {AddFinding} add
 * @returns {void}
 */
export function checkExport(ts, file, node, add) {
  const functions = exportedFunctions(ts, file, node);
  const comments = ts.getLeadingCommentRanges(file.text, node.getFullStart()) ?? [];
  const docs = comments
    .filter((comment) => file.text.startsWith('/**', comment.pos))
    .map((comment) => file.text.slice(comment.pos, comment.end));

  // JavaScript can't declare a return type, so a JSDoc `@returns` (or `@type`) counts instead.
  for (const fn of functions) {
    const hasJsDocType = file.isJavaScript && docs.some((doc) => JSDOC_RETURNS.test(doc));
    if (!fn.type && !hasJsDocType) {
      add(node, {
        rule: 'types',
        id: 'missing-return-type',
        level: 'error',
        message: 'exported function without a declared return type',
        scope: 'api',
      });
    }
  }

  const documentable =
    ts.isFunctionDeclaration(node) ||
    ts.isVariableStatement(node) ||
    ts.isClassDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    (ts.isExportAssignment(node) && !ts.isIdentifier(node.expression));
  if (documentable && docs.length === 0) {
    add(node, {
      rule: '10',
      id: 'missing-doc',
      level: 'review',
      message: 'export without a doc comment',
    });
  }
}
