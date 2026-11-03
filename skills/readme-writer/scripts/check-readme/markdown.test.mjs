import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { countWords, headingLabel, isShellBlock, parseMarkdown, visibleText } from './markdown.mjs';
import { readme } from './testing/repo.mjs';

describe('parseMarkdown', () => {
  it('separates fenced code from prose and keeps the block language and start line', () => {
    const doc = parseMarkdown(readme('Intro text', '', '```Bash', 'npm test', '```', 'After'));
    assert.deepEqual(doc.codeBlocks, [
      { marker: '```', lang: 'bash', start: 3, lines: [{ line: 4, text: 'npm test' }] },
    ]);
    assert.deepEqual(
      doc.prose.map(({ line }) => line),
      [1, 2, 6],
    );
  });

  it('only closes a fence with the same character and at least the same length', () => {
    const doc = parseMarkdown(readme('````md', '```', '~~~', '````', 'prose'));
    assert.deepEqual(
      doc.codeBlocks[0].lines.map(({ text }) => text),
      ['```', '~~~'],
    );
    assert.deepEqual(doc.prose, [{ line: 5, text: 'prose' }]);
  });

  it('keeps an unclosed fence as a code block that runs to the end of the file', () => {
    const doc = parseMarkdown(readme('```', 'echo hi', 'still code'));
    assert.equal(doc.codeBlocks.length, 1);
    assert.equal(doc.codeBlocks[0].lines.length, 2);
    assert.deepEqual(doc.prose, []);
  });

  it('reads ATX, setext and HTML headings', () => {
    const doc = parseMarkdown(
      readme('# Title #', 'Section', '-------', '<h3 align="center">Deep</h3>'),
    );
    assert.deepEqual(doc.headings, [
      { line: 1, level: 1, text: 'Title' },
      { line: 2, level: 2, text: 'Section' },
      { line: 4, level: 3, text: 'Deep' },
    ]);
    assert.deepEqual(
      doc.prose.map(({ line }) => line),
      [4],
    );
  });

  it('treats a dash line under a list item or blank line as prose', () => {
    const doc = parseMarkdown(readme('- item', '---', '', '---'));
    assert.deepEqual(doc.headings, []);
    assert.deepEqual(
      doc.prose.map(({ text }) => text),
      ['- item', '---', '', '---'],
    );
  });

  it('drops a setext underline that follows a code block instead of promoting a line', () => {
    const doc = parseMarkdown(readme('Text', '```', 'code', '```', '==='));
    assert.deepEqual(doc.headings, []);
    assert.deepEqual(doc.prose, [{ line: 1, text: 'Text' }]);
  });

  it('skips multi-line HTML comments and strips inline ones', () => {
    const doc = parseMarkdown(readme('<!--', 'hidden', '-->', 'shown <!-- note --> text'));
    assert.deepEqual(doc.prose, [{ line: 4, text: 'shown  text' }]);
  });

  it('counts only the words a reader sees', () => {
    const doc = parseMarkdown(readme('Read [the docs](https://x.dev) at https://x.dev', '`code`'));
    assert.equal(doc.wordCount, 4);
  });
});

describe('visibleText', () => {
  it('keeps link labels and drops images, code, tags and URLs', () => {
    const text = visibleText('<b>Hi</b> ![logo](l.png) [docs](d.md) `x` https://a.b');
    assert.equal(text.split(/\s+/).filter(Boolean).join(' '), 'Hi docs');
  });
});

describe('headingLabel', () => {
  it('drops emoji and leading symbols', () => {
    assert.equal(headingLabel('🚀️ — Getting started'), 'Getting started');
  });
});

describe('countWords', () => {
  it('counts words separated by any whitespace', () => {
    assert.equal(countWords('  one\ttwo   three '), 3);
  });
});

describe('isShellBlock', () => {
  it('accepts unlabelled and shell blocks and rejects other languages', () => {
    assert.equal(isShellBlock({ lang: '' }), true);
    assert.equal(isShellBlock({ lang: 'console' }), true);
    assert.equal(isShellBlock({ lang: 'ts' }), false);
  });
});
