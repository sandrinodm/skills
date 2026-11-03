import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

describe('checkLinks', () => {
  it('reports relative links to files that do not exist', () => {
    const findings = findingsFor({
      'README.md': readme('See [the guide](docs/guide.md) and [setup](docs/setup.md#install).'),
      'docs/setup.md': '# Setup',
    });
    assert.deepEqual(
      withRule(findings, 'broken-link').map(({ line, level }) => [line, level]),
      [[1, 'error']],
    );
    assert.match(withRule(findings, 'broken-link')[0].message, /^"docs\/guide\.md" doesn't exist/);
  });

  it('resolves links that start with a slash from the repo root', () => {
    const findings = findingsFor(
      {
        'packages/ui/README.md': 'Read [the license](/LICENSE) and [the notes](/NOTES.md).',
        LICENSE: 'MIT',
      },
      { readmePath: 'packages/ui/README.md' },
    );
    assert.deepEqual(
      withRule(findings, 'broken-link').map(({ message }) => message.split(' ')[0]),
      ['"/NOTES.md"'],
    );
  });

  it('checks reference definitions and HTML links but never external URLs', () => {
    const findings = findingsFor({
      'README.md': readme(
        '[home]: https://example.com',
        '[docs]: ./missing.md',
        '<a href="./gone.html">gone</a> <img src="logo.png">',
        '[mail](mailto:a@b.c) [proto](//cdn.example.com/x.js)',
      ),
      'logo.png': '',
    });
    assert.deepEqual(
      withRule(findings, 'broken-link').map(({ line }) => line),
      [2, 3],
    );
  });

  it('reports anchors that no heading or id produces', () => {
    const findings = findingsFor({
      'README.md': readme(
        '# Tool',
        '## Usage',
        '## Usage',
        '## `run()` options',
        '<a name="faq"></a>',
        '[a](#usage) [b](#usage-1) [c](#run-options) [d](#FAQ) [e](#missing)',
      ),
    });
    assert.deepEqual(
      withRule(findings, 'broken-anchor').map(({ message }) => message),
      ['link to "#missing" but no heading produces that anchor'],
    );
  });
});
