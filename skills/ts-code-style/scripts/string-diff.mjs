#!/usr/bin/env node
/**
 * Compare the string literals in two TypeScript/JavaScript source trees.
 *
 * A readability refactor must not change the text that users, clients or subprocesses receive.
 * This script extracts every string literal from both trees, joins literals that are concatenated
 * with `+` (so splitting a long string across lines is not a change), keeps template expressions
 * as written (so replacing `200` with `${MAX_PARTS}` shows up for review), and prints the strings
 * that exist in only one tree.
 *
 * Usage:
 *   node string-diff.mjs <before-dir> <after-dir> [--tests] [--all] [--min=<n>]
 *
 *   --tests    also scan *.test.*, *.spec.* and *.fixture.* files (skipped by default)
 *   --all      report every literal, not only ones that look user-facing (contain a space and
 *              are at least --min characters long)
 *   --min=<n>  minimum length for a user-facing literal (default 12)
 *
 * Exit status: 0 when both trees contain the same strings, 1 when they differ, 2 on usage errors.
 * No dependencies; requires Node 18 or later.
 */
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next']);
const TEST_FILE_PATTERN = /\.(test|spec|fixture)\.[cm]?[jt]sx?$/;
const DECLARATION_FILE_PATTERN = /\.d\.[cm]?ts$/;

/**
 * Characters after which a `/` starts a regex literal rather than a division.
 */
const REGEX_PRECEDERS = new Set([...'(,=:[!&|?{};+-*%<>~^']);
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return',
  'typeof',
  'case',
  'do',
  'else',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'yield',
  'await',
]);

function parseArguments(argv) {
  const options = { tests: false, all: false, min: 12 };
  const directories = [];
  for (const argument of argv) {
    if (argument === '--tests') {
      options.tests = true;
    } else if (argument === '--all') {
      options.all = true;
    } else if (argument.startsWith('--min=')) {
      options.min = Number(argument.slice('--min='.length));
    } else if (argument === '--help' || argument === '-h') {
      return undefined;
    } else {
      directories.push(argument);
    }
  }
  if (directories.length !== 2 || !Number.isInteger(options.min) || options.min < 0) {
    return undefined;
  }
  return { before: directories[0], after: directories[1], options };
}

function* sourceFiles(root, includeTests) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        yield* sourceFiles(full, includeTests);
      }
      continue;
    }
    const isSource =
      SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
      !DECLARATION_FILE_PATTERN.test(entry.name) &&
      (includeTests || !TEST_FILE_PATTERN.test(entry.name));
    if (entry.isFile() && isSource) {
      yield full;
    }
  }
}

/**
 * A small lexer that yields string tokens, `+` tokens and "other" tokens, skipping whitespace and
 * comments. It understands quotes, escapes, template literals with nested expressions, and regex
 * literals, which is enough to find string literals reliably without a TypeScript parser.
 */
class Lexer {
  constructor(source) {
    this.source = source;
    this.index = 0;
    this.previousSignificant = '';
    this.previousWord = '';
  }

  *tokens() {
    const { source } = this;
    while (this.index < source.length) {
      const char = source[this.index];
      const next = source[this.index + 1];

      if (/\s/.test(char)) {
        this.index++;
      } else if (char === '/' && next === '/') {
        this.skipUntil('\n');
      } else if (char === '/' && next === '*') {
        const end = source.indexOf('*/', this.index + 2);
        this.index = end === -1 ? source.length : end + 2;
      } else if (char === "'" || char === '"') {
        yield this.remember({ type: 'string', value: this.readQuoted(char) }, char);
      } else if (char === '`') {
        yield this.remember({ type: 'string', value: this.readTemplate() }, '`');
      } else if (char === '/' && this.startsRegex()) {
        this.readRegex();
        yield this.remember({ type: 'other' }, '/');
      } else if (char === '+' && next !== '+' && next !== '=') {
        this.index++;
        yield this.remember({ type: 'plus' }, '+');
      } else if (/[A-Za-z_$]/.test(char)) {
        const start = this.index;
        while (this.index < source.length && /[\w$]/.test(source[this.index])) {
          this.index++;
        }
        const word = source.slice(start, this.index);
        this.previousWord = word;
        yield this.remember({ type: 'other' }, 'a');
      } else {
        this.index++;
        yield this.remember({ type: 'other' }, char);
      }
    }
  }

  remember(token, significant) {
    if (significant !== 'a') {
      this.previousWord = '';
    }
    this.previousSignificant = significant;
    return token;
  }

  startsRegex() {
    if (this.previousSignificant === '') {
      return true;
    }
    if (this.previousSignificant === 'a') {
      return REGEX_PRECEDING_KEYWORDS.has(this.previousWord);
    }
    return REGEX_PRECEDERS.has(this.previousSignificant);
  }

  skipUntil(terminator) {
    const end = this.source.indexOf(terminator, this.index);
    this.index = end === -1 ? this.source.length : end;
  }

  readQuoted(quote) {
    const { source } = this;
    let value = '';
    this.index++;
    while (this.index < source.length && source[this.index] !== quote) {
      if (source[this.index] === '\\') {
        value += source.slice(this.index, this.index + 2);
        this.index += 2;
      } else if (source[this.index] === '\n') {
        break; // An unterminated string; stop at the line end.
      } else {
        value += source[this.index++];
      }
    }
    this.index++;
    return value;
  }

  readTemplate() {
    const { source } = this;
    let value = '';
    this.index++;
    while (this.index < source.length && source[this.index] !== '`') {
      if (source[this.index] === '\\') {
        value += source.slice(this.index, this.index + 2);
        this.index += 2;
      } else if (source[this.index] === '$' && source[this.index + 1] === '{') {
        value += `\${${this.readTemplateExpression()}}`;
      } else {
        value += source[this.index++];
      }
    }
    this.index++;
    return value;
  }

  /**
   * Read a `${…}` expression, including nested strings, templates and braces, and return its
   * source with whitespace collapsed so that reformatting alone doesn't register as a change.
   */
  readTemplateExpression() {
    const { source } = this;
    const start = this.index + 2;
    let depth = 1;
    this.index = start;
    while (this.index < source.length && depth > 0) {
      const char = source[this.index];
      if (char === "'" || char === '"') {
        this.readQuoted(char);
      } else if (char === '`') {
        this.readTemplate();
      } else {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
        }
        this.index++;
      }
    }
    return source
      .slice(start, this.index - 1)
      .replace(/\s+/g, ' ')
      .replace(/,\s*([)\]}])/g, '$1') // trailing commas added by the formatter
      .replace(/([([{])\s+/g, '$1')
      .replace(/\s+([)\]}])/g, '$1')
      .trim();
  }

  readRegex() {
    const { source } = this;
    let inClass = false;
    this.index++;
    while (this.index < source.length) {
      const char = source[this.index];
      if (char === '\\') {
        this.index += 2;
        continue;
      }
      if (char === '\n') {
        return;
      }
      this.index++;
      if (char === '[') {
        inClass = true;
      } else if (char === ']') {
        inClass = false;
      } else if (char === '/' && !inClass) {
        break;
      }
    }
    while (this.index < source.length && /[a-z]/i.test(source[this.index])) {
      this.index++;
    }
  }
}

/**
 * Extract literals from one file, joining runs of `literal + literal + …` into one value.
 */
function literalsIn(source) {
  const literals = [];
  let run;
  let pendingPlus = false;
  const flush = () => {
    if (run !== undefined) {
      literals.push(run);
    }
    run = undefined;
    pendingPlus = false;
  };

  for (const token of new Lexer(source).tokens()) {
    if (token.type === 'string') {
      if (run !== undefined && pendingPlus) {
        run += token.value;
        pendingPlus = false;
      } else {
        flush();
        run = token.value;
      }
    } else if (token.type === 'plus' && run !== undefined && !pendingPlus) {
      pendingPlus = true;
    } else {
      flush();
    }
  }
  flush();
  return literals;
}

function stringsInTree(root, options) {
  const found = new Map();
  for (const file of sourceFiles(root, options.tests)) {
    const relative = path.relative(root, file);
    for (const literal of literalsIn(fs.readFileSync(file, 'utf8'))) {
      const userFacing = literal.length >= options.min && /\s/.test(literal);
      if (options.all || userFacing) {
        if (!found.has(literal)) {
          found.set(literal, new Set());
        }
        found.get(literal).add(relative);
      }
    }
  }
  return found;
}

function report(title, strings, otherTree) {
  const missing = [...strings.keys()].filter((literal) => !otherTree.has(literal)).sort();
  console.log(`--- ${title} (${missing.length})`);
  for (const literal of missing) {
    console.log(`${JSON.stringify(literal)}\n    in ${[...strings.get(literal)].join(', ')}`);
  }
  return missing.length;
}

const parsed = parseArguments(process.argv.slice(2));
if (!parsed) {
  console.error('Usage: node string-diff.mjs <before-dir> <after-dir> [--tests] [--all] [--min=<n>]');
  process.exit(2);
}
for (const directory of [parsed.before, parsed.after]) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    console.error(`Not a directory: ${directory}`);
    process.exit(2);
  }
}

const before = stringsInTree(parsed.before, parsed.options);
const after = stringsInTree(parsed.after, parsed.options);
const removed = report('Only in before', before, after);
const added = report('Only in after', after, before);
console.log(
  removed + added === 0
    ? `Same ${before.size} strings in both trees.`
    : `${removed} removed, ${added} added. Explain each difference before calling the pass done.`,
);
process.exit(removed + added === 0 ? 0 : 1);
