import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

function styleFindings(text) {
  return findingsFor({ 'README.md': text }, { styleOnly: true });
}

describe('checkLists', () => {
  it('reports a run of bold-label bullets at its first line', () => {
    const findings = styleFindings(
      readme(
        'Intro',
        '- **Fast**: Built for speed from the ground up.',
        '- **Safe:** Every input is checked before use.',
        '',
        '- **Small** — Only a few kilobytes once minified.',
      ),
    );
    assert.deepEqual(
      withRule(findings, 'bold-label-list').map(({ line }) => line),
      [2],
    );
  });

  it('leaves reference lists with identifier labels or short values alone', () => {
    const findings = styleFindings(
      readme(
        '- **cat** - Concatenate files and print them',
        '- **ES Module**: `dist/x.mjs`',
        '- **ls** - List the files in a folder',
      ),
    );
    assert.deepEqual(withRule(findings, 'bold-label-list'), []);
  });

  it('ends a run at a non-bullet line', () => {
    const findings = styleFindings(
      readme(
        '- **Fast**: Built for real speed.',
        '- **Safe**: Checks every single input.',
        'A paragraph.',
        '- **Small**: Only a few kilobytes.',
      ),
    );
    assert.deepEqual(withRule(findings, 'bold-label-list'), []);
  });

  it('reports three bullets that start with an emoji', () => {
    const findings = styleFindings(readme('1. 🚀 Fast', '2. 🔒 Safe', '3. 📦 Small'));
    assert.deepEqual(withRule(findings, 'emoji-bullets'), [
      {
        line: 1,
        level: 'slop',
        rule: 'emoji-bullets',
        message: '3 bullets that start with an emoji; drop the emoji',
      },
    ]);
  });
});
