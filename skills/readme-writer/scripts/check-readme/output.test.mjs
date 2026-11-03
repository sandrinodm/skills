import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFinding } from './findings.mjs';
import { formatJson, formatText } from './output.mjs';

const REPORTS = [
  {
    file: 'README.md',
    words: 120,
    lines: 40,
    findings: [
      createFinding(3, 'broken-link', '"x.md" doesn\'t exist (resolved to x.md)'),
      createFinding(12, 'slop-word', '"robust": say what it does or show the number instead'),
      createFinding(1, 'no-install', 'published package "x" but the README never shows the name'),
    ],
  },
  { file: 'docs/README.md', words: 5, lines: 2, findings: [] },
];

describe('formatText', () => {
  it('prints aligned findings per file and the totals', () => {
    assert.equal(
      formatText(REPORTS),
      [
        'README.md (40 lines, 120 words)',
        '     3  error  broken-link            "x.md" doesn\'t exist (resolved to x.md)',
        '    12  slop   slop-word              ' +
          '"robust": say what it does or show the number instead',
        '     1  note   no-install             ' +
          'published package "x" but the README never shows the name',
        '',
        'docs/README.md (2 lines, 5 words)',
        '  no findings',
        '',
        '1 errors, 1 slop, 1 notes',
      ].join('\n'),
    );
  });
});

describe('formatJson', () => {
  it('prints the reports as JSON indented by two spaces', () => {
    const json = formatJson(REPORTS.slice(1));
    assert.equal(
      json,
      [
        '[',
        '  {',
        '    "file": "docs/README.md",',
        '    "words": 5,',
        '    "lines": 2,',
        '    "findings": []',
        '  }',
        ']',
      ].join('\n'),
    );
  });
});
