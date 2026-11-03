import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

function styleFindings(text) {
  return findingsFor({ 'README.md': text }, { styleOnly: true });
}

describe('checkHeadings', () => {
  it('reports a second H1 at its line', () => {
    const findings = withRule(styleFindings(readme('# One', '', '# Two')), 'multiple-h1');
    assert.deepEqual(findings, [
      {
        line: 3,
        level: 'note',
        rule: 'multiple-h1',
        message: '2 top-level headings; use one H1 for the name and H2s for sections',
      },
    ]);
  });

  it('reports emoji in section headings but not in the title', () => {
    const findings = styleFindings(readme('# 🚀 Rocket', '', '## ✨ Features'));
    assert.deepEqual(
      withRule(findings, 'emoji-heading').map(({ line }) => line),
      [3],
    );
  });

  it('suggests sentence case for Title Case section headings', () => {
    const [finding] = withRule(
      styleFindings(readme('# Tool', '## Getting Started With Docker Compose')),
      'title-case-heading',
    );
    assert.equal(
      finding.message,
      '"Getting Started With Docker Compose": sentence case reads more naturally ' +
        '("Getting started with docker compose")',
    );
  });

  it('leaves headings with too few capitalized words alone', () => {
    const findings = styleFindings(readme('# Tool', '## Using React Hooks'));
    assert.deepEqual(withRule(findings, 'title-case-heading'), []);
  });

  it('reports a conclusion section', () => {
    const findings = styleFindings(readme('# Tool', '## 🎉 Conclusion'));
    assert.equal(withRule(findings, 'closing-summary').length, 1);
  });

  it('reports a table of contents only in a short README', () => {
    const short = styleFindings(readme('# Tool', '## Table of contents'));
    assert.equal(withRule(short, 'short-toc').length, 1);

    const long = styleFindings(readme('# Tool', '## Contents', ...Array(150).fill('text')));
    assert.deepEqual(withRule(long, 'short-toc'), []);
  });
});
