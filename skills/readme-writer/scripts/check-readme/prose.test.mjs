import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

function styleFindings(text) {
  return findingsFor({ 'README.md': text }, { styleOnly: true });
}

describe('checkProse', () => {
  it('reports the first marketing word on a line', () => {
    const findings = withRule(styleFindings('A robust and powerful tool.'), 'slop-word');
    assert.deepEqual(findings, [
      {
        line: 1,
        level: 'slop',
        rule: 'slop-word',
        message: '"robust": say what it does or show the number instead',
      },
    ]);
  });

  it('ignores marketing words inside inline code and link targets', () => {
    const findings = styleFindings('Run `robust --check` or see [docs](./powerful.md).');
    assert.deepEqual(withRule(findings, 'slop-word'), []);
  });

  it('reports each chat or marketing phrase with its label', () => {
    const findings = styleFindings("Feel free to open an issue. Let's dive in!");
    assert.deepEqual(
      withRule(findings, 'slop-phrase').map(({ message }) => message),
      ['chat phrase: "Feel free to"', 'chat phrase: "Let\'s dive in"'],
    );
  });

  it('reports placeholders in prose as errors', () => {
    const findings = styleFindings('Clone github.com/your-username/tool, released 2025-XX-XX.');
    assert.deepEqual(
      withRule(findings, 'placeholder').map(({ message }) => message),
      ['placeholder name: "your-username"', 'placeholder date: "2025-XX-XX"'],
    );
  });

  it('allows bracketed arguments in code but not placeholder names', () => {
    const findings = styleFindings(
      readme('```sh', 'tool [add more flags]', 'git clone your-org/tool', '```'),
    );
    assert.deepEqual(
      withRule(findings, 'placeholder').map(({ line, message }) => [line, message]),
      [[3, 'placeholder name in a code block: "your-org"']],
    );
  });

  it('reports scaffolder boilerplate', () => {
    const findings = styleFindings(
      'This is a [Next.js](https://nextjs.org) project bootstrapped with `create-next-app`.',
    );
    assert.equal(
      withRule(findings, 'template-boilerplate')[0].message,
      'create-next-app README left in place; ' +
        'replace it with what this project is and how to run it',
    );
  });

  it('allows four em dashes in a short README and reports five', () => {
    const four = styleFindings(readme(...Array(4).fill('One — two.')));
    assert.deepEqual(withRule(four, 'em-dashes'), []);

    const five = styleFindings(readme(...Array(5).fill('One — two.')));
    assert.deepEqual(withRule(five, 'em-dashes'), [
      {
        line: 1,
        level: 'slop',
        rule: 'em-dashes',
        message:
          '5 em dashes in 15 words (lines 1, 2, 3, 4, 5); ' +
          'use periods, commas, colons or parentheses for most of them',
      },
    ]);
  });

  it('lists at most eight em-dash lines', () => {
    const findings = styleFindings(readme(...Array(10).fill('a—b')));
    assert.match(
      withRule(findings, 'em-dashes')[0].message,
      /\(lines 1, 2, 3, 4, 5, 6, 7, 8, \.\.\.\)/,
    );
  });
});
