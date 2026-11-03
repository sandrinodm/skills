#!/usr/bin/env node
/**
 * Check TypeScript and JavaScript files against every ts-code-style rule a parser can decide.
 *
 * The script parses each file with the TypeScript compiler and reports findings by rule number,
 * with `path:line`, so a cleanup, a review or new code gets the same mechanical checklist every
 * time. Two levels:
 *
 *   error    breaks a rule outright: a blank line between a value and its check, a nested
 *            ternary, an unbraced `if`, an `enum`, `any`, a banner comment, a duplicated error.
 *   review   a candidate a person has to judge: a magic number, a long function, a long
 *            condition, a repeated message, an `as` assertion.
 *
 * It doesn't check everything the rules ask for: names, structure, whether a comment explains
 * why, and anything that needs type information (deprecated APIs, unused exports) are left to the
 * reader and to the project's linter.
 *
 * Findings that change a type or an exported API are tagged `api`, and file-layout findings are
 * tagged `files`. A readability pass reports those as recommendations instead of fixing them,
 * unless the user chose deeper restructuring.
 *
 * Usage:
 *   node style-check.mjs <file-or-dir>... [--write] [--json] [--rules=1,5] [--width=100]
 *                        [--typescript=<dir>]
 *
 *   --write             fix the spacing findings (rule 1) in place, then report what is left
 *   --json              print { files, findings, counts } as JSON instead of text
 *   --rules=…           only report these rules (comma-separated: 1-13, types, files)
 *   --width=N           report lines longer than N columns (default 100, 0 to skip)
 *   --typescript=<dir>  load `typescript` from this folder instead of the current directory
 *
 * Directories are scanned for .ts, .tsx, .mts, .cts, .js, .jsx, .mjs and .cjs files, skipping
 * node_modules, dist, build, coverage, .git, .next and generated `*.gen.*` files.
 *
 * Exit status: 0 when there are no error findings, 1 when there are, 2 on usage errors or when no
 * usable `typescript` package can be found.
 * Requires Node 18 or later and the `typescript` package (5.x or 6.x, which have the JavaScript
 * compiler API), loaded from the current directory (or --typescript), never from the checked
 * folders: loading a package runs its code. TypeScript 7 is the native compiler and has no
 * JavaScript API; with it, the script prints an `npx` command that runs it with 6.
 */
import { checkFile } from './style-check/check-file.mjs';
import { checkDuplicateErrors, checkRepeatedMessages } from './style-check/duplicates.mjs';
import { checkImportCycles } from './style-check/import-cycles.mjs';
import { countFindings, printFindings } from './style-check/report.mjs';
import { RULE_NAMES } from './style-check/rules.mjs';
import { listSourceFiles, parseFile, uniqueFiles } from './style-check/source-files.mjs';
import { fixSpacing } from './style-check/spacing.mjs';
import { loadTypeScript } from './style-check/typescript.mjs';
import { UsageError } from './style-check/usage-error.mjs';

const DEFAULT_WIDTH = 100;
const EXIT_CLEAN = 0;
const EXIT_ERRORS = 1;
const EXIT_USAGE = 2;
const USAGE =
  'Usage: node style-check.mjs <file-or-dir>... [--write] [--json] [--rules=1,5] [--width=100] ' +
  '[--typescript=<dir>]';

const FLAGS = new Set(['--write', '--json']);
const VALUE_FLAGS = ['--rules=', '--width=', '--typescript='];

main();

// Sets the exit status instead of calling process.exit(), so output piped to a slow reader is
// flushed before the process ends.
function main() {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof UsageError)) {
      throw error;
    }

    console.error(error.message);
    process.exitCode = EXIT_USAGE;
  }
}

// Checks the files the arguments name, prints the findings, and returns the exit status.
function run(args) {
  const options = parseArgs(args);
  const ts = loadTypeScript(options.typescriptDir);
  const files = uniqueFiles(options.targets.flatMap((target) => listSourceFiles(target)));
  let parsed = files.map((file) => parseFile(ts, file));

  if (options.write) {
    const fixed = parsed.filter((file) => fixSpacing(ts, file));
    parsed = parsed.map((file) => (fixed.includes(file) ? parseFile(ts, file.path) : file));
  }

  const findings = collectFindings(ts, parsed, options);
  const counts = countFindings(findings);

  if (options.json) {
    console.log(JSON.stringify({ files: files.length, findings, counts }, null, 2));
  } else {
    printFindings(findings, counts, files.length);
  }

  return counts.error > 0 ? EXIT_ERRORS : EXIT_CLEAN;
}

// Every finding for the parsed files, limited to the rules asked for, in file and line order.
function collectFindings(ts, parsed, options) {
  const findings = [
    ...parsed.flatMap((file) => checkFile(ts, file, options)),
    ...checkDuplicateErrors(ts, parsed),
    ...checkRepeatedMessages(ts, parsed),
    ...checkImportCycles(ts, parsed),
  ];
  return findings
    .filter((finding) => options.rules === null || options.rules.has(String(finding.rule)))
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function parseArgs(args) {
  const targets = args.filter((arg) => !arg.startsWith('--'));
  const unknown = args.filter(
    (arg) =>
      arg.startsWith('--') && !FLAGS.has(arg) && !VALUE_FLAGS.some((flag) => arg.startsWith(flag)),
  );
  const valuesOf = (flag) =>
    args.filter((arg) => arg.startsWith(flag)).map((arg) => arg.slice(flag.length));
  const rules = valuesOf('--rules=').flatMap((value) => value.split(','));
  const widths = valuesOf('--width=');
  const typescriptDirs = valuesOf('--typescript=');
  const width = widths.length > 0 ? Number(widths.at(-1)) : DEFAULT_WIDTH;
  const unknownRules = rules.filter((rule) => !Object.hasOwn(RULE_NAMES, rule));
  const badWidths = widths.filter(
    (value) => value === '' || !(Number.isInteger(Number(value)) && Number(value) >= 0),
  );
  const ruleList = Object.keys(RULE_NAMES).join(', ');
  const problems = [
    ...unknown.map((flag) => `unknown option ${flag}`),
    ...unknownRules.map((rule) => `unknown rule "${rule}" (rules: ${ruleList})`),
    ...badWidths.map((value) => `--width must be a whole number, got "${value}"`),
    ...(typescriptDirs.includes('') ? ['--typescript needs a folder'] : []),
  ];
  if (targets.length === 0 || problems.length > 0) {
    throw new UsageError([...problems, USAGE].join('\n'));
  }

  return {
    targets,
    write: args.includes('--write'),
    json: args.includes('--json'),
    rules: rules.length > 0 ? new Set(rules) : null,
    width,
    typescriptDir: typescriptDirs.at(-1) ?? null,
  };
}
