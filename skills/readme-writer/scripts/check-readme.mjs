#!/usr/bin/env node

// Checks README files for broken facts and for the habits that make a README read as generated.
//
// Usage:
//   node check-readme.mjs README.md packages/*/README.md
//   node check-readme.mjs --style-only some-readme.md   (skip every check that reads the repo)
//   node check-readme.mjs --json README.md
//
// Findings have three levels:
//   error  something a reader will trip over: a broken link, a script or workspace package that
//          doesn't exist, a leftover placeholder or template, a license that contradicts
//          package.json
//   slop   a habit that makes the README read as generated: emoji headings, marketing words,
//          bold-label bullet lists, badge walls, chat phrases
//   note   worth a look, often fine: title-case headings, a late first example, env vars the
//          README doesn't mention, a License section with no license file
//
// Exits 1 when there is at least one error or slop finding, 0 otherwise. Node 18+, no dependencies.
// The checks live in check-readme/, one file per concern; check-readmes.mjs runs them.

import { checkReadmes } from './check-readme/check-readmes.mjs';
import { isFailure } from './check-readme/findings.mjs';
import { formatJson, formatText } from './check-readme/output.mjs';

const USAGE = 'Usage: node check-readme.mjs [--style-only] [--json] README.md [more READMEs]';
const FLAGS = new Set(['--style-only', '--json']);
const EXIT_CLEAN = 0;
const EXIT_FINDINGS = 1;
const EXIT_USAGE = 2;

main();

// Sets `process.exitCode` instead of calling `process.exit()`, so output piped to a slow reader is
// flushed before the process ends.
function main() {
  const { files, unknown, styleOnly, asJson } = parseArgs(process.argv.slice(2));
  if (files.length === 0 || unknown.length > 0) {
    console.error([...unknown.map((flag) => `unknown option ${flag}`), USAGE].join('\n'));
    process.exitCode = EXIT_USAGE;
    return;
  }

  const reports = checkReadmes(files, { styleOnly });
  console.log(asJson ? formatJson(reports) : formatText(reports));

  const failed = reports.some((report) => report.findings.some(isFailure));
  process.exitCode = failed ? EXIT_FINDINGS : EXIT_CLEAN;
}

// Every argument that doesn't start with `--` is a README path.
function parseArgs(args) {
  const flags = args.filter((arg) => arg.startsWith('--'));
  return {
    files: args.filter((arg) => !arg.startsWith('--')),
    unknown: flags.filter((flag) => !FLAGS.has(flag)),
    styleOnly: flags.includes('--style-only'),
    asJson: flags.includes('--json'),
  };
}
