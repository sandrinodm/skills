import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

const CLI = new URL('./style-check.mjs', import.meta.url).pathname;
const TYPESCRIPT_DIR = findTypeScriptDir();
const SKIP_REASON = 'needs typescript 5.x or 6.x reachable from the current directory';
const skip = TYPESCRIPT_DIR ? false : SKIP_REASON;

describe('rule 1: spacing', { skip }, () => {
  it('reports a blank line between a value and the check that uses it', () => {
    const { findings } = check({
      'src/verify.ts': [
        'export function verify(token: string): string {',
        '  const response = fetch(url, {',
        '    headers: { authorization: token },',
        '  });',
        '',
        '  if (!response.ok) {',
        "    throw new Error('rejected');",
        '  }',
        '',
        '  return token;',
        '}',
      ],
    });
    assert.deepEqual(ids(findings, '1'), [['split-step', 5]]);
  });

  it('counts a comment between the value and its use as part of the same step', () => {
    const { findings } = check({
      'src/read.ts': [
        'export function read(): void {',
        '  const value = load();',
        '',
        '  // Invalid input cannot proceed.',
        '  if (!value) {',
        '    return;',
        '  }',
        '}',
      ],
    });
    assert.deepEqual(ids(findings, '1'), [['split-step', 3]]);
  });

  it('leaves a name used only inside a callback alone', () => {
    const { findings } = check({
      'src/fixture.ts': [
        'export function suite(): void {',
        '  const fixture = setup();',
        '',
        "  it('works', () => verify(fixture));",
        '}',
      ],
    });
    assert.deepEqual(ids(findings, '1'), []);
  });

  it('reports block edges, a missing blank after a block and double blank lines', () => {
    const { findings } = check({
      'src/edges.ts': [
        'export function edges(ready: boolean): void {',
        '',
        '  if (ready) {',
        '    work();',
        '  }',
        '  finish();',
        '',
        '',
        '  done();',
        '}',
        '',
        'export class Box {',
        '',
        '  size = 1;',
        '}',
      ],
    });
    assert.deepEqual(ids(findings, '1'), [
      ['blank-at-block-start', 2],
      ['missing-blank-after-block', 5],
      ['double-blank', 8],
      ['blank-at-block-start', 13],
    ]);
  });

  it('fixes spacing with --write, keeps CRLF endings, and is idempotent', () => {
    const dir = fixture({
      'src/fix.ts': [
        'export function fix(ready: boolean): void {',
        '  const value = read();',
        '',
        '  if (value && ready) {',
        '    work();',
        '  }',
        '  finish();',
        '}',
      ],
    });
    const file = path.join(dir, 'src/fix.ts');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('\n', '\r\n'));

    run([dir, '--write']);
    const once = fs.readFileSync(file, 'utf8');
    run([dir, '--write']);

    assert.equal(fs.readFileSync(file, 'utf8'), once);
    assert.equal(once.split('\r\n').length - 1, once.split('\n').length - 1);
    assert.match(once, /read\(\);\r\n {2}if/);
    assert.match(once, /\}\r\n\r\n {2}finish/);
  });

  it("doesn't insert a blank line where it would change a template literal", () => {
    const source = ['export function f(): void {', '  if (a) {} const text = `x', 'y`;', '}'];
    const dir = fixture({ 'src/template.ts': source });
    const { status } = run([dir, '--write']);

    assert.equal(
      fs.readFileSync(path.join(dir, 'src/template.ts'), 'utf8'),
      source.join('\n') + '\n',
    );
    assert.equal(status, 1);
  });
});

describe('rules 2 to 10', { skip }, () => {
  it('reports magic numbers but not named constants, radixes or HTTP statuses', () => {
    const { findings } = check({
      'src/numbers.ts': [
        'const delay = 60000;',
        'const LIMITS = { max: 50 };',
        'export function f(value: string): number {',
        '  if (value.length > 280) {',
        '    throw new ApiError(400, value);',
        '  }',
        '',
        '  return Number.parseInt(value, 10);',
        '}',
      ],
    });
    assert.deepEqual(ids(findings, '2'), [
      ['magic-number', 1],
      ['magic-number', 4],
    ]);
  });

  it('matches duplicate errors through literal values and constants, not shadowed names', () => {
    const { findings } = check({
      'src/messages.ts': ["export const NOT_FOUND = 'not found';"],
      'src/errors.ts': [
        "import { NOT_FOUND } from './messages';",
        '',
        'export function a(): never {',
        '  throw new Error(NOT_FOUND);',
        '}',
        '',
        'export function b(): never {',
        '  throw new Error("not found");',
        '}',
        '',
        'export function c(ApiError: ErrorConstructor): never {',
        "  throw new ApiError('gone');",
        '}',
        '',
        'export function d(ApiError: ErrorConstructor): never {',
        "  throw new ApiError('gone');",
        '}',
      ],
    });
    assert.deepEqual(ids(findings, '3'), [
      ['duplicate-error', 4],
      ['duplicate-error', 8],
    ]);
  });

  it('reports nested ternaries, unbraced and same-line bodies, and long conditions', () => {
    const { findings } = check({
      'src/flow.ts': [
        'export function flow(a: boolean, b: boolean, c: boolean, d: boolean): string {',
        "  const label = a ? (b ? 'x' : 'y') : 'z';",
        '  if (a) return label;',
        '',
        '  if (b) { work(); }',
        '',
        '  if (a && b && c && d) {',
        "    return 'all';",
        '  }',
        '',
        '  return label;',
        '}',
      ],
    });
    assert.deepEqual(ids(findings, '5'), [
      ['nested-ternary', 2],
      ['unbraced-body', 3],
      ['same-line-body', 5],
    ]);
    assert.deepEqual(ids(findings, '6'), [['long-condition', 7]]);
  });

  it('reports positional undefined but not in assertions', () => {
    const { findings } = check({
      'src/calls.ts': [
        'export function calls(): void {',
        '  total(order, undefined, 3000);',
        '  assert.equal(value, undefined, message);',
        '}',
      ],
    });
    assert.deepEqual(ids(findings, '7'), [['positional-undefined', 2]]);
  });

  it('reports banner and history comments but not standards that look like tickets', () => {
    const { findings } = check({
      'src/comments.ts': [
        '// ── Data ──',
        '// Fixes ABC-123.',
        '// Encodes UTF-8 and hashes with SHA-256.',
        '/** The answer. */',
        'export const X = 1;',
      ],
    });
    assert.deepEqual(ids(findings, '10'), [
      ['banner-comment', 1],
      ['history-comment', 2],
    ]);
  });

  it('reports console in Effect generators only', () => {
    const { findings } = check({
      'src/program.ts': [
        "import { Effect, Schema } from 'effect';",
        '',
        "console.log('starting');",
        '',
        'export const program = Effect.gen(function* () {',
        "  console.log('inside');",
        '});',
      ],
    });
    assert.deepEqual(ids(findings, '9'), [['console-in-effect', 6]]);
  });
});

describe('types and files', { skip }, () => {
  it('reports enum, any, Function, method shorthand and plain interfaces', () => {
    const { findings } = check({
      'src/types.ts': [
        "enum Status { Open = 'open' }",
        'interface Order {',
        '  save(): void;',
        '}',
        'type Handler = (value: any, next: Function) => void;',
      ],
    });
    assert.deepEqual(ids(findings, 'types'), [
      ['enum', 1],
      ['plain-interface', 2],
      ['method-shorthand', 3],
      ['any', 5],
      ['function-type', 5],
    ]);
  });

  it('accepts a JSDoc @returns in JavaScript and follows export { f } and export default', () => {
    const { findings } = check({
      'src/count.js': ['/** @returns {number} */', 'export function count() {', '  return 0;', '}'],
      'src/later.ts': [
        'function f() {',
        '  return 1;',
        '}',
        '',
        'export { f };',
        'export default () => 1;',
      ],
    });
    const missing = findings.filter((finding) => finding.id === 'missing-return-type');
    assert.deepEqual(
      missing.map((finding) => [path.basename(finding.file), finding.line]),
      [
        ['later.ts', 1],
        ['later.ts', 6],
      ],
    );
  });

  it('reports file names, test folders and real import cycles, not type-only ones', () => {
    const { findings } = check({
      'src/OrderService.ts': ["import { b } from './b';", 'export const a = b;'],
      'src/b.ts': ["import { a } from './OrderService';", 'export const b = 1;', 'void a;'],
      'src/types-a.ts': ["import type { B } from './types-b';", 'export type A = { b: B };'],
      'src/types-b.ts': ["import type { A } from './types-a';", 'export type B = { a?: A };'],
      'src/__tests__/order.test.ts': ["it('works', () => {});"],
    });
    assert.deepEqual(
      findings
        .filter((finding) => finding.rule === 'files')
        .map((finding) => [finding.id, path.basename(finding.file)]),
      [
        ['file-name', 'OrderService.ts'],
        ['import-cycle', 'OrderService.ts'],
        ['test-location', 'order.test.ts'],
      ].sort(([, a], [, b]) => a.localeCompare(b)),
    );
  });
});

describe('command line', { skip }, () => {
  it('exits 2 with every problem listed for bad options', () => {
    const { status, stderr } = run(['src', '--rules=typo', '--bogus', '--width=']);
    assert.equal(status, 2);
    assert.match(stderr, /unknown option --bogus/);
    assert.match(stderr, /unknown rule "typo"/);
    assert.match(stderr, /--width must be a whole number, got ""/);
    assert.match(stderr, /^Usage: /m);
  });

  it('exits 2 for a path that does not exist', () => {
    const { status, stderr } = run([path.join(os.tmpdir(), 'style-check-missing')]);
    assert.equal(status, 2);
    assert.match(stderr, /doesn't exist/);
  });

  it('exits 0 for clean code and limits the report with --rules', () => {
    const dir = fixture({
      'src/clean.ts': [
        '/** Adds one. */',
        'export function next(n: number): number {',
        '  return n + 1;',
        '}',
      ],
      'src/messy.ts': ['/** A. */', 'export const a = (x: boolean): string => (x ? "a" : "b");'],
    });
    assert.equal(run([path.join(dir, 'src/clean.ts')]).status, 0);
    assert.equal(run([dir, '--rules=5']).status, 0);
  });
});

/** Writes the files to a new temp folder and runs the checker on it with --json. */
function check(files) {
  const { stdout, status } = run([fixture(files), '--json']);
  return { ...JSON.parse(stdout), status };
}

function run(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: TYPESCRIPT_DIR ?? process.cwd(),
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'style-check-'));

  for (const [name, lines] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), lines.join('\n') + '\n');
  }

  return dir;
}

// The [id, line] pairs of one rule's findings, in report order.
function ids(findings, rule) {
  return findings
    .filter((finding) => finding.rule === rule)
    .map((finding) => [finding.id, finding.line]);
}

// A folder from which `require('typescript')` gives the JavaScript compiler API, or null.
function findTypeScriptDir() {
  try {
    const ts = createRequire(path.join(process.cwd(), 'noop.js'))('typescript');
    return typeof ts.createSourceFile === 'function' ? process.cwd() : null;
  } catch {
    return null;
  }
}
