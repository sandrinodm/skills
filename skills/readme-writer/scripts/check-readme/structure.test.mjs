import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

function styleFindings(text) {
  return findingsFor({ 'README.md': text }, { styleOnly: true });
}

describe('checkStructure', () => {
  it('reports more than two horizontal rules', () => {
    const findings = styleFindings(readme('# Tool', '', '---', 'a', '', '***', 'b', '', '___'));
    assert.deepEqual(withRule(findings, 'rule-overuse'), [
      {
        line: 3,
        level: 'slop',
        rule: 'rule-overuse',
        message: '3 horizontal rules; headings already separate sections',
      },
    ]);
  });

  it('reports a first code block after line 80', () => {
    const findings = styleFindings(readme(...Array(81).fill('text'), '```', 'x', '```'));
    assert.deepEqual(
      withRule(findings, 'late-example').map(({ line }) => line),
      [82],
    );
  });

  it('reports a Contributing section with nothing to act on', () => {
    const findings = styleFindings(
      readme('# Tool', '## Contributing', 'PRs welcome!', '## License'),
    );
    assert.deepEqual(
      withRule(findings, 'empty-contributing').map(({ line }) => line),
      [2],
    );
  });

  it('accepts a Contributing section with a link or a command', () => {
    const withLink = styleFindings(readme('## Contributing', 'See [the guide](CONTRIBUTING.md).'));
    assert.deepEqual(withRule(withLink, 'empty-contributing'), []);

    const withCode = styleFindings(readme('## Contributing', '```sh', 'npm test', '```'));
    assert.deepEqual(withRule(withCode, 'empty-contributing'), []);
  });
});
