// Layout checks: horizontal-rule overuse, a first example that comes too late, and a Contributing
// section with nothing a contributor can act on.

import { countWords, headingLabel } from './markdown.mjs';

const MAX_RULES = 2;
const LATE_FIRST_EXAMPLE_LINE = 80;
const SHORT_SECTION_WORDS = 25;

const HORIZONTAL_RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const CONTRIBUTING_SECTION = /^contribut/i;
const LINK_OR_URL = /\]\(|https?:\/\//;

/**
 * Reports rule-overuse, late-example and empty-contributing.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkStructure(doc, add) {
  checkHorizontalRules(doc, add);
  checkFirstExample(doc, add);
  checkContributingSections(doc, add);
}

// A `---` right under text is a setext heading, so only rules after a blank line (or on the first
// line) count.
function checkHorizontalRules(doc, add) {
  const rules = doc.prose.filter(
    ({ text }, index, all) =>
      HORIZONTAL_RULE.test(text) && (index === 0 || all[index - 1].text.trim() === ''),
  );
  if (rules.length > MAX_RULES) {
    add(
      rules[0].line,
      'rule-overuse',
      `${rules.length} horizontal rules; headings already separate sections`,
    );
  }
}

function checkFirstExample(doc, add) {
  const firstBlock = doc.codeBlocks[0];
  if (firstBlock && firstBlock.start > LATE_FIRST_EXAMPLE_LINE) {
    add(
      firstBlock.start,
      'late-example',
      `first code block is at line ${firstBlock.start}; ` +
        'readers decide before then whether the project fits',
    );
  }
}

function checkContributingSections(doc, add) {
  for (const [index, heading] of doc.headings.entries()) {
    if (!CONTRIBUTING_SECTION.test(headingLabel(heading.text))) {
      continue;
    }

    // The section runs to the next heading of any level, or to the end of the file.
    const end = doc.headings[index + 1]?.line ?? doc.lines.length + 1;
    const body = doc.prose
      .filter(({ line }) => line > heading.line && line < end)
      .map(({ text }) => text)
      .join(' ');
    const hasLink = LINK_OR_URL.test(body);
    const hasCode = doc.codeBlocks.some((block) => block.start > heading.line && block.start < end);
    if (countWords(body) < SHORT_SECTION_WORDS && !hasLink && !hasCode) {
      add(
        heading.line,
        'empty-contributing',
        'Contributing section with no process, command or link; ' +
          'link CONTRIBUTING.md, show the dev commands, or drop the section',
      );
    }
  }
}
