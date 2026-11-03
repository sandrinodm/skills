import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

function shell(...commands) {
  return readme('```sh', ...commands, '```');
}

describe('checkCommands', () => {
  it('reports make targets and just recipes that are not defined', () => {
    const findings = findingsFor({
      'README.md': shell('make build test VERBOSE=1', 'just --list', 'just deploy'),
      Makefile: 'build:\n\tgo build\nVAR := 1\n',
      justfile: 'test arg:\n  echo {{arg}}\n',
    });
    assert.deepEqual(
      withRule(findings, 'missing-target').map(({ line, message }) => [line, message]),
      [
        [2, 'make target "test" isn\'t in the Makefile'],
        [4, 'just recipe "deploy" isn\'t in the justfile'],
      ],
    );
  });

  it('skips make and just commands when the repo has no Makefile or justfile', () => {
    const findings = findingsFor({ 'README.md': shell('make all', 'just build') });
    assert.deepEqual(withRule(findings, 'missing-target'), []);
  });

  it('reports cd into a directory that does not exist', () => {
    const findings = findingsFor({
      'README.md': shell('$ cd apps/web && cd apps/api', 'cd ~/code', 'cd <your-dir>'),
      'apps/web/': '',
    });
    assert.deepEqual(
      withRule(findings, 'missing-dir').map(({ message }) => message),
      ['"cd apps/api": no such directory in this repo'],
    );
  });

  it('allows cd into a directory the block creates', () => {
    const findings = findingsFor({
      'README.md': shell('git clone https://github.com/acme/tool.git', 'cd tool'),
    });
    assert.deepEqual(withRule(findings, 'missing-dir'), []);
  });

  it('reports script paths that do not exist, with or without an interpreter', () => {
    const findings = findingsFor({
      'README.md': shell(
        'node scripts/seed.mjs',
        'python3 tools/gen.py # regenerate',
        './scripts/setup.sh; echo done',
      ),
      'scripts/seed.mjs': '',
    });
    assert.deepEqual(
      withRule(findings, 'missing-file').map(({ message }) => message),
      ['"tools/gen.py" doesn\'t exist', '"./scripts/setup.sh" doesn\'t exist'],
    );
  });

  it('ignores commands outside shell blocks and comment lines', () => {
    const findings = findingsFor({
      'README.md': readme(
        '```js',
        'node missing.mjs',
        '```',
        '```bash',
        '# node gone/x.mjs',
        '```',
      ),
    });
    assert.deepEqual(withRule(findings, 'missing-file'), []);
  });
});
