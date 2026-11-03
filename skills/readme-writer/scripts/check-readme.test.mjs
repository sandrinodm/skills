import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { makeRepo, readme, removeRepos } from './check-readme/testing/repo.mjs';

after(removeRepos);

const SCRIPT = fileURLToPath(new URL('./check-readme.mjs', import.meta.url));

function run(args, cwd) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('check-readme.mjs', () => {
  it('prints the usage and exits 2 without files', () => {
    const result = run(['--json']);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.equal(
      result.stderr,
      'Usage: node check-readme.mjs [--style-only] [--json] README.md [more READMEs]\n',
    );
  });

  it('exits 1 and prints the findings when there is an error or slop finding', () => {
    const root = makeRepo({ 'README.md': readme('# Tool', '', 'A robust tool.') });
    const result = run(['README.md'], root);
    assert.equal(result.status, 1);
    assert.equal(
      result.stdout,
      [
        'README.md (3 lines, 3 words)',
        '     3  slop   slop-word              ' +
          '"robust": say what it does or show the number instead',
        '',
        '0 errors, 1 slop, 0 notes',
        '',
      ].join('\n'),
    );
  });

  it('exits 0 when there are only notes', () => {
    const root = makeRepo({ 'README.md': readme('# One', '# Two') });
    const result = run(['--style-only', 'README.md'], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /0 errors, 0 slop, 1 notes\n$/);
  });

  it('prints JSON with --json and skips repo checks with --style-only', () => {
    const root = makeRepo({ 'README.md': 'See [gone](gone.md).' });
    const styleOnly = JSON.parse(run(['--json', '--style-only', 'README.md'], root).stdout);
    assert.deepEqual(styleOnly[0].findings, []);

    const full = JSON.parse(run(['--json', path.join(root, 'README.md')], root).stdout);
    assert.deepEqual(
      full[0].findings.map(({ rule }) => rule),
      ['broken-link'],
    );
  });

  it('never includes the parsed document in --json output, for any number of files', () => {
    const root = makeRepo({ 'README.md': readme('# Tool', '', 'Does one thing.') });
    const [report] = JSON.parse(run(['--json', 'README.md'], root).stdout);
    assert.deepEqual(Object.keys(report), ['file', 'words', 'lines', 'findings']);
  });

  it('exits 2 and names an unknown option', () => {
    const result = run(['--jsno', 'README.md']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^unknown option --jsno\nUsage: /);
  });

  it("doesn't crash on a malformed % escape in a link", () => {
    const root = makeRepo({ 'README.md': 'See [the sale](50%off.md) and [top](#100%-real).' });
    const [report] = JSON.parse(run(['--json', 'README.md'], root).stdout);
    assert.deepEqual(
      report.findings.map(({ rule }) => rule),
      ['broken-link', 'broken-anchor'],
    );
  });
});
