// Rule 3, one home for every error and message: the same error built twice across the checked
// files, and the same message written out twice in a file.

import {
  ERROR_CONSTRUCTOR,
  declaredNames,
  importedNames,
  isLiteral,
  isShadowed,
  literalValue,
  unwrapExpression,
  unwrapParent,
} from './ast.mjs';
import { realPath, resolveImport } from './source-files.mjs';

/** @typedef {import('./typescript.mjs').TypeScript} TypeScript */
/** @typedef {import('./source-files.mjs').ParsedFile} ParsedFile */
/** @typedef {import('./rules.mjs').Finding} Finding */
const MIN_MESSAGE_LENGTH = 10;
// How many re-exporting files a constant is followed through.
const MAX_IMPORT_HOPS = 3;
const WHITESPACE_RUN = /\s+/g;
// A comparison with a string is a check, not a message: `kind === 'not found'`.
const EQUALITY_OPERATOR = /^[=!]==?$/;
const MAX_ERROR_PREVIEW_CHARS = 70;
const ONE_FACTORY = 'use one factory';
/**
 * Rule 3 across all checked files: the same error class built with the same argument values in more
 * than one place. Arguments can be literals or constants holding them; a call with any other
 * argument, or with a shadowed constructor, is left out.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile[]} files
 * @returns {Finding[]}
 */
export function checkDuplicateErrors(ts, files) {
  const sites = new Map();
  const filesByPath = new Map(files.map((file) => [realPath(file.path), file]));

  for (const file of files.filter(({ isTest }) => !isTest)) {
    const visit = (node) => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ERROR_CONSTRUCTOR.test(node.expression.text)
      ) {
        const args = node.arguments ?? [];
        const values = args.map((arg) => argumentValue(ts, file, filesByPath, arg));
        if (args.length > 0 && values.every((value) => value !== null)) {
          const origin = constructorOrigin(ts, file, node.expression);
          const key = `${origin} ${JSON.stringify(values)}`;
          if (origin) {
            sites.set(key, [...(sites.get(key) ?? []), { file, node }]);
          }
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(file.source);
  }

  return [...sites.values()]
    .filter((places) => places.length > 1)
    .flatMap((places) =>
      places.map(({ file, node }) => ({
        file: file.path,
        line: file.lineOf(node.getStart(file.source)) + 1,
        rule: '3',
        id: 'duplicate-error',
        level: 'error',
        message:
          `\`${preview(node.getText(file.source))}\` is built in ${places.length} places; ` +
          ONE_FACTORY,
      })),
    );
}

// The value an error argument stands for: a literal, a module-level `const` that holds one (here
// or in a checked file it's imported from), or a property of a `const` object literal
// (`MESSAGES.notFound`). Null when it can't be known, which keeps the call out of the comparison.
function argumentValue(ts, file, filesByPath, node) {
  if (isLiteral(ts, node)) {
    return literalValue(ts, node);
  }

  if (ts.isIdentifier(node) && !isShadowed(ts, node)) {
    const value = constantInitializer(ts, file, filesByPath, node.text);
    return value && isLiteral(ts, value) ? literalValue(ts, value) : null;
  }

  const isCatalogLookup =
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    !isShadowed(ts, node.expression);
  if (!isCatalogLookup) {
    return null;
  }

  const catalog = constantInitializer(ts, file, filesByPath, node.expression.text);
  const entry =
    catalog && ts.isObjectLiteralExpression(catalog)
      ? catalog.properties.find(
          (property) =>
            ts.isPropertyAssignment(property) && property.name.getText() === node.name.text,
        )
      : null;
  const value = entry && unwrapExpression(ts, entry.initializer);
  return value && isLiteral(ts, value) ? literalValue(ts, value) : null;
}

// The initializer of a module-level `const name`, following one relative import into another
// checked file. Wrappers that don't change the value (`as const`, `satisfies`, parentheses) are
// removed.
function constantInitializer(ts, file, filesByPath, name, depth = 0) {
  for (const statement of file.source.statements) {
    const isConst =
      ts.isVariableStatement(statement) &&
      (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    const declaration = isConst
      ? statement.declarationList.declarations.find(
          (item) => ts.isIdentifier(item.name) && item.name.text === name,
        )
      : null;
    if (declaration?.initializer) {
      return unwrapExpression(ts, declaration.initializer);
    }

    const imported = ts.isImportDeclaration(statement)
      ? importedNames(ts, statement).get(name)
      : null;
    const specifier = imported ? statement.moduleSpecifier.text : '';
    const resolved = specifier.startsWith('.') ? resolveImport(file.path, specifier) : null;
    const source = resolved ? filesByPath.get(realPath(resolved)) : null;
    if (source && depth < MAX_IMPORT_HOPS) {
      return constantInitializer(ts, source, filesByPath, imported, depth + 1);
    }
  }

  return null;
}

// Where an error class comes from, so two unrelated `ApiError`s aren't treated as one: the module
// it's imported from, this file when it's declared here, or a global.
function constructorOrigin(ts, file, identifier) {
  const name = identifier.text;

  // A parameter or local with this name shadows the module-level one; its origin is unknown.
  if (isShadowed(ts, identifier)) {
    return null;
  }

  for (const statement of file.source.statements) {
    const binding = ts.isImportDeclaration(statement)
      ? importedNames(ts, statement).get(name)
      : null;
    if (binding) {
      const specifier = statement.moduleSpecifier.text;
      const resolved = specifier.startsWith('.') ? resolveImport(file.path, specifier) : null;
      return `${resolved ? realPath(resolved) : specifier}#${binding}`;
    }

    if (declaredNames(ts, statement).includes(name)) {
      return `${realPath(file.path)}#${name}`;
    }
  }

  return `global#${name}`;
}

function preview(text) {
  const oneLine = text.replace(WHITESPACE_RUN, ' ');
  return oneLine.length > MAX_ERROR_PREVIEW_CHARS
    ? `${oneLine.slice(0, MAX_ERROR_PREVIEW_CHARS)}…`
    : oneLine;
}

/**
 * Rule 3 within a file: a user-facing message (a string with a space, at least MIN_MESSAGE_LENGTH
 * characters) written out more than once. Imports, types, keys and comparisons don't count; test
 * files are skipped.
 *
 * @param {TypeScript} ts
 * @param {ParsedFile[]} files
 * @returns {Finding[]}
 */
export function checkRepeatedMessages(ts, files) {
  const findings = [];

  for (const file of files.filter(({ isTest }) => !isTest)) {
    const sites = new Map();

    const visit = (node) => {
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        isMessage(ts, node)
      ) {
        sites.set(node.text, [...(sites.get(node.text) ?? []), node]);
      }

      ts.forEachChild(node, visit);
    };
    visit(file.source);

    for (const [text, nodes] of sites) {
      for (const node of nodes.length > 1 ? nodes : []) {
        findings.push({
          file: file.path,
          line: file.lineOf(node.getStart(file.source)) + 1,
          rule: '3',
          id: 'repeated-message',
          level: 'review',
          message: `"${preview(text)}" appears ${nodes.length} times; give it one home`,
        });
      }
    }
  }

  return findings;
}

function isMessage(ts, node) {
  const parent = unwrapParent(ts, node);
  const isStructural =
    ts.isComputedPropertyName(parent) ||
    ts.isElementAccessExpression(parent) ||
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isLiteralTypeNode(parent) ||
    ts.isExternalModuleReference(parent) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    ts.isCaseClause(parent) ||
    (ts.isBinaryExpression(parent) && EQUALITY_OPERATOR.test(parent.operatorToken.getText()));
  return !isStructural && node.text.length >= MIN_MESSAGE_LENGTH && node.text.includes(' ');
}
