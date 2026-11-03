import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./string-diff.mjs', import.meta.url));
const USAGE =
  'Usage: node string-diff.mjs <before-dir> <after-dir> [--tests] [--all] [--min=<n>]\n';
const ORDERS_SOURCE = "export const missing = 'Order not found for this user';\n";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'string-diff-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

describe('string-diff', () => {
  it('reports no differences when both trees hold the same strings', () => {
    const { before, after } = trees(
      { 'src/orders.ts': ORDERS_SOURCE },
      { 'src/orders.ts': ORDERS_SOURCE },
    );
    const result = run(before, after);
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout,
      '--- Only in before (0)\n--- Only in after (0)\nSame 1 strings in both trees.\n',
    );
    assert.equal(result.stderr, '');
  });

  it('treats a string split with + as the same string', () => {
    const split = "export const missing = 'Order not found ' +\n  'for this user';\n";
    const { before, after } = trees({ 'src/orders.ts': ORDERS_SOURCE }, { 'src/orders.ts': split });
    assert.equal(run(before, after).status, 0);
  });

  it('lists a changed message under each tree and exits with 1', () => {
    const changed = "export const missing = 'Order missing for this user';\n";
    const { before, after } = trees(
      { 'src/orders.ts': ORDERS_SOURCE },
      { 'src/orders.ts': changed },
    );
    const result = run(before, after);
    assert.equal(result.status, 1);
    assert.equal(
      result.stdout,
      [
        '--- Only in before (1)',
        '"Order not found for this user"',
        '    in src/orders.ts',
        '--- Only in after (1)',
        '"Order missing for this user"',
        '    in src/orders.ts',
        '1 removed, 1 added. Explain each difference before calling the pass done.',
        '',
      ].join('\n'),
    );
  });

  it('keeps template expressions, so a number replaced by a constant shows up', () => {
    const literal = 'export const limit = `Send at most 200 parts per message.`;\n';
    const constant = 'export const limit = `Send at most ${MAX_PARTS} parts per message.`;\n';
    const { before, after } = trees({ 'limits.ts': literal }, { 'limits.ts': constant });
    const result = run(before, after);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^"Send at most \$\{MAX_PARTS\} parts per message\."$/m);
  });

  it('ignores reformatting inside template expressions', () => {
    const compact = 'export const found = `Found ${count(items, { deep: true })} matches`;\n';
    const wrapped = [
      'export const found = `Found ${count(',
      '  items,',
      '  { deep: true },',
      ')} matches`;',
      '',
    ].join('\n');
    const { before, after } = trees({ 'found.ts': compact }, { 'found.ts': wrapped });
    assert.equal(run(before, after).status, 0);
  });

  it('skips test files unless --tests is passed', () => {
    const test = "it('returns the order for this user', () => {});\n";
    const { before, after } = trees(
      { 'src/orders.ts': ORDERS_SOURCE },
      { 'src/orders.ts': ORDERS_SOURCE, 'src/orders.test.ts': test },
    );
    assert.equal(run(before, after).status, 0);

    const withTests = run(before, after, '--tests');
    assert.equal(withTests.status, 1);
    assert.match(withTests.stdout, /^ {4}in src\/orders\.test\.ts$/m);
  });

  it('reports short literals only with --all', () => {
    const { before, after } = trees(
      { 'keys.ts': "export const key = 'id';\n" },
      { 'keys.ts': "export const key = 'uuid';\n" },
    );
    assert.equal(run(before, after).status, 0);
    assert.equal(run(before, after, '--all').status, 1);
  });

  it('uses --min as the shortest length that counts as user-facing', () => {
    const { before, after } = trees(
      { 'labels.ts': "export const label = 'Save it';\n" },
      { 'labels.ts': "export const label = 'Keep it';\n" },
    );
    assert.equal(run(before, after).status, 0);
    assert.equal(run(before, after, '--min=7').status, 1);
  });

  it('does not read quotes in comments, regex literals or divisions as strings', () => {
    const tricky = [
      "// It's a comment with a 'quoted phrase in it'.",
      '/* And a "block comment" that isn\'t code. */',
      'const pattern = /don\'t "match" this one/;',
      'const ratio = total / count / 2;',
      "export const label = 'Shown to the user here';",
      '',
    ].join('\n');
    const plain = "export const label = 'Shown to the user here';\n";
    const { before, after } = trees({ 'view.ts': tricky }, { 'view.ts': plain });
    const result = run(before, after);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Same 1 strings in both trees\.$/m);
  });

  it('skips dependencies, build output and declaration files', () => {
    const extra = "export const note = 'Not part of the source tree';\n";
    const { before, after } = trees(
      { 'src/orders.ts': ORDERS_SOURCE },
      {
        'src/orders.ts': ORDERS_SOURCE,
        'node_modules/pkg/index.js': extra,
        'dist/orders.js': extra,
        'src/orders.d.ts': extra,
      },
    );
    assert.equal(run(before, after).status, 0);
  });

  it('prints the usage and exits with 2 without exactly two directories', () => {
    const { before } = trees({}, {});
    const result = run(before);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, USAGE);
    assert.equal(result.stdout, '');
  });

  it('prints the usage and exits with 2 for --help and an invalid --min', () => {
    const { before, after } = trees({}, {});
    for (const flag of ['--help', '-h', '--min=abc', '--min=-1', '--min=1.5']) {
      const result = run(before, after, flag);
      assert.equal(result.status, 2, flag);
      assert.equal(result.stderr, USAGE, flag);
    }
  });

  it('exits with 2 when a path is not a directory', () => {
    const { before } = trees({}, {});
    const missing = path.join(scratch, 'does-not-exist');
    const result = run(before, missing);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, `Not a directory: ${missing}\n`);
  });
});

/**
 * Creates a fresh "before" and "after" tree in the scratch folder from maps of relative path to
 * file contents.
 */
function trees(beforeFiles, afterFiles) {
  const root = fs.mkdtempSync(path.join(scratch, 'case-'));
  const before = writeTree(path.join(root, 'before'), beforeFiles);
  const after = writeTree(path.join(root, 'after'), afterFiles);
  return { before, after };
}

function writeTree(root, files) {
  fs.mkdirSync(root, { recursive: true });
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }

  return root;
}

function run(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}
