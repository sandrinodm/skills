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

const USAGE = 'Usage: node string-diff.mjs <before-dir> <after-dir> [--tests] [--all] [--min=<n>]';
const MIN_FLAG = '--min=';
const DEFAULT_MIN_LITERAL_LENGTH = 12;

const EXIT_SAME = 0;
const EXIT_DIFFERENT = 1;
const EXIT_USAGE = 2;

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next']);
const TEST_FILE_PATTERN = /\.(test|spec|fixture)\.[cm]?[jt]sx?$/;
const DECLARATION_FILE_PATTERN = /\.d\.[cm]?ts$/;

const WHITESPACE = /\s/;
const IDENTIFIER_START = /[A-Za-z_$]/;
const IDENTIFIER_PART = /[\w$]/;
const REGEX_FLAG = /[a-z]/i;

/**
 * The lexer remembers the last significant character to tell a regex from a division. Every
 * identifier or keyword is remembered as this one marker, and the word itself is kept separately.
 */
const WORD_MARKER = 'a';

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

/**
 * These patterns normalize a template's `${…}` source, so that reformatting it (line breaks,
 * padding inside brackets, the trailing commas a formatter adds) doesn't register as a change.
 */
const WHITESPACE_RUN = /\s+/g;
const TRAILING_COMMA = /,\s*([)\]}])/g;
const SPACE_AFTER_OPENING_BRACKET = /([([{])\s+/g;
const SPACE_BEFORE_CLOSING_BRACKET = /\s+([)\]}])/g;

/**
 * Parses the arguments, checks both trees and prints the strings found in only one of them.
 * Sets the exit status described in the file header. It sets `process.exitCode` instead of
 * calling `process.exit()`, so output piped to a slow reader is flushed before the process ends.
 */
function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (!parsed) {
    console.error(USAGE);
    process.exitCode = EXIT_USAGE;
    return;
  }

  for (const directory of [parsed.before, parsed.after]) {
    if (!isDirectory(directory)) {
      console.error(`Not a directory: ${directory}`);
      process.exitCode = EXIT_USAGE;
      return;
    }
  }

  const before = stringsInTree(parsed.before, parsed.options);
  const after = stringsInTree(parsed.after, parsed.options);
  const removed = report('Only in before', before, after);
  const added = report('Only in after', after, before);
  const differences = removed + added;
  if (differences === 0) {
    console.log(`Same ${before.size} strings in both trees.`);
    process.exitCode = EXIT_SAME;
    return;
  }

  console.log(
    `${removed} removed, ${added} added. Explain each difference before calling the pass done.`,
  );
  process.exitCode = EXIT_DIFFERENT;
}

/**
 * Returns the two directories and the options, or `undefined` for `--help` and for anything that
 * isn't exactly two directories with a whole, non-negative `--min`. Unknown flags count as
 * directories, so they fail the directory check with a clear message.
 */
function parseArguments(argv) {
  const options = { tests: false, all: false, min: DEFAULT_MIN_LITERAL_LENGTH };
  const directories = [];
  for (const argument of argv) {
    if (argument === '--tests') {
      options.tests = true;
    } else if (argument === '--all') {
      options.all = true;
    } else if (argument.startsWith(MIN_FLAG)) {
      options.min = Number(argument.slice(MIN_FLAG.length));
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

function isDirectory(directory) {
  return fs.existsSync(directory) && fs.statSync(directory).isDirectory();
}

/**
 * Maps every literal worth reporting to the set of files (relative to `root`) that contain it.
 */
function stringsInTree(root, options) {
  const found = new Map();
  for (const file of sourceFiles(root, options.tests)) {
    const relative = path.relative(root, file);
    for (const literal of literalsIn(fs.readFileSync(file, 'utf8'))) {
      if (options.all || isUserFacing(literal, options.min)) {
        addLocation(found, literal, relative);
      }
    }
  }

  return found;
}

/**
 * Yields the source files under `root`, skipping build output, dependencies, declaration files
 * and, unless `includeTests` is set, tests and fixtures. Symbolic links are skipped.
 */
function* sourceFiles(root, includeTests) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        yield* sourceFiles(full, includeTests);
      }

      continue;
    }

    if (entry.isFile() && isSourceFile(entry.name, includeTests)) {
      yield full;
    }
  }
}

function isSourceFile(name, includeTests) {
  return (
    SOURCE_EXTENSIONS.has(path.extname(name)) &&
    !DECLARATION_FILE_PATTERN.test(name) &&
    (includeTests || !TEST_FILE_PATTERN.test(name))
  );
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

/**
 * A literal that people read is at least `minLength` characters long and has a space in it, which
 * leaves out identifiers, keys, paths and other machine-facing strings.
 */
function isUserFacing(literal, minLength) {
  return literal.length >= minLength && WHITESPACE.test(literal);
}

function addLocation(found, literal, file) {
  if (!found.has(literal)) {
    found.set(literal, new Set());
  }

  found.get(literal).add(file);
}

/**
 * Prints the literals in `strings` that `otherTree` lacks, sorted, each with the files it's in,
 * and returns how many there were.
 */
function report(title, strings, otherTree) {
  const missing = [...strings.keys()].filter((literal) => !otherTree.has(literal)).sort();
  console.log(`--- ${title} (${missing.length})`);
  for (const literal of missing) {
    console.log(`${JSON.stringify(literal)}\n    in ${[...strings.get(literal)].join(', ')}`);
  }

  return missing.length;
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
      if (WHITESPACE.test(char)) {
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
      } else if (IDENTIFIER_START.test(char)) {
        this.previousWord = this.readWord();
        yield this.remember({ type: 'other' }, WORD_MARKER);
      } else {
        this.index++;
        yield this.remember({ type: 'other' }, char);
      }
    }
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
        // The string is unterminated, so it ends at the line end.
        break;
      } else {
        value += source[this.index++];
      }
    }

    this.index++;
    return value;
  }

  /**
   * Records the token's significant character for `startsRegex`. Any token other than a word
   * forgets the last word, so `startsRegex` only sees a keyword directly before the `/`.
   */
  remember(token, significant) {
    if (significant !== WORD_MARKER) {
      this.previousWord = '';
    }

    this.previousSignificant = significant;
    return token;
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
      .replace(WHITESPACE_RUN, ' ')
      .replace(TRAILING_COMMA, '$1')
      .replace(SPACE_AFTER_OPENING_BRACKET, '$1')
      .replace(SPACE_BEFORE_CLOSING_BRACKET, '$1')
      .trim();
  }

  /**
   * A `/` starts a regex at the start of the file, after an operator or opening bracket, and after
   * a keyword such as `return`. After a name, a number or a closing bracket it's a division.
   */
  startsRegex() {
    if (this.previousSignificant === '') {
      return true;
    }

    if (this.previousSignificant === WORD_MARKER) {
      return REGEX_PRECEDING_KEYWORDS.has(this.previousWord);
    }

    return REGEX_PRECEDERS.has(this.previousSignificant);
  }

  /**
   * Skips a regex literal and its flags. A `/` inside a character class doesn't end it. A regex
   * can't span lines, so a line break ends the scan.
   */
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

    while (this.index < source.length && REGEX_FLAG.test(source[this.index])) {
      this.index++;
    }
  }

  readWord() {
    const start = this.index;
    while (this.index < this.source.length && IDENTIFIER_PART.test(this.source[this.index])) {
      this.index++;
    }

    return this.source.slice(start, this.index);
  }
}

// Runs last because `Lexer` is a class, and a class can't be used before its definition runs.
main();
