import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

const USAGE = readme(
  '```ts',
  "import { memo, type Options, clear as reset } from 'ttl-memo';",
  '```',
);

function exportFindings(files) {
  return withRule(findingsFor({ 'README.md': USAGE, ...files }), 'missing-export');
}

describe('checkImports', () => {
  it('reports imported names the entry file does not export', () => {
    const findings = exportFindings({
      'package.json': { name: 'ttl-memo', main: 'index.js' },
      'index.js': 'export function memo() {}\nexport { a as Options };\n',
    });
    assert.deepEqual(findings, [
      {
        line: 2,
        level: 'error',
        rule: 'missing-export',
        message: '"clear" isn\'t exported by ttl-memo (exports: memo, Options)',
      },
    ]);
  });

  it('reads the source file when a dist entry has not been built', () => {
    const findings = exportFindings({
      'package.json': { name: 'ttl-memo', exports: { '.': { import: './dist/index.js' } } },
      'src/index.ts': 'export const memo = 1;\nexport type Options = {};\nexport { clear };\n',
    });
    assert.deepEqual(findings, []);
  });

  it('skips entries that re-export with export *', () => {
    const findings = exportFindings({
      'package.json': { name: 'ttl-memo' },
      'src/index.ts': "export * from './memo';\n",
    });
    assert.deepEqual(findings, []);
  });

  it('skips packages whose entry cannot be found', () => {
    const findings = exportFindings({ 'package.json': { name: 'ttl-memo', main: 'lib/x.js' } });
    assert.deepEqual(findings, []);
  });
});
