// Heading checks: one H1, no emoji or Title Case in section headings, no conclusion section, and
// no hand-written table of contents in a short README.

import { headingLabel, visibleText } from './markdown.mjs';

const SHORT_README_LINES = 150;
const MIN_TITLE_CASE_WORDS = 3;

const EMOJI = /\p{Extended_Pictographic}/u;
const CLOSING_SECTION = /^(conclusion|summary|final thoughts|wrapping up|closing thoughts)$/i;
const CONTENTS_SECTION = /^(table of contents|contents|toc)$/i;
const NON_WORD_CHARACTERS = /[^\p{L}\p{N}\s'-]/gu;
const WHITESPACE = /\s+/;
const STARTS_WITH_LETTER = /^\p{L}/u;
const CAPITALIZED = /^\p{Lu}\p{Ll}/u;
const CAPITALIZED_AFTER_SPACE = /(?<=\s)(\p{Lu})(\p{Ll}+)/gu;

// Words that stay lowercase in Title Case, so they don't count either way.
const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'for',
  'nor',
  'on',
  'at',
  'to',
  'from',
  'by',
  'of',
  'in',
  'with',
  'vs',
  'via',
  'as',
  'is',
]);

/**
 * Reports multiple-h1, emoji-heading, title-case-heading, closing-summary and short-toc.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkHeadings(doc, add) {
  checkTopLevelHeadings(doc, add);

  for (const heading of doc.headings) {
    checkHeading(heading, add);
  }

  checkTableOfContents(doc, add);
}

function checkTopLevelHeadings(doc, add) {
  const topLevel = doc.headings.filter((heading) => heading.level === 1);
  if (topLevel.length > 1) {
    add(
      topLevel[1].line,
      'multiple-h1',
      `${topLevel.length} top-level headings; use one H1 for the name and H2s for sections`,
    );
  }
}

function checkHeading(heading, add) {
  const text = visibleText(heading.text);
  if (EMOJI.test(text) && heading.level > 1) {
    add(heading.line, 'emoji-heading', `"${heading.text}": drop the emoji from the heading`);
  }

  if (heading.level > 1 && isTitleCase(text)) {
    add(
      heading.line,
      'title-case-heading',
      `"${heading.text}": sentence case reads more naturally ("${toSentenceCase(text)}")`,
    );
  }

  if (CLOSING_SECTION.test(headingLabel(heading.text))) {
    add(heading.line, 'closing-summary', `"${heading.text}": a README doesn't need a conclusion`);
  }
}

function checkTableOfContents(doc, add) {
  const contents = doc.headings.find((heading) =>
    CONTENTS_SECTION.test(headingLabel(heading.text)),
  );
  if (contents && doc.lines.length < SHORT_README_LINES) {
    add(
      contents.line,
      'short-toc',
      `hand-written table of contents in a ${doc.lines.length}-line README; ` +
        'GitHub already renders one from the headings',
    );
  }
}

// Title Case means every significant word after the first is capitalized, and there are enough of
// them that it isn't just a couple of proper nouns.
function isTitleCase(text) {
  const words = text.replace(NON_WORD_CHARACTERS, ' ').split(WHITESPACE).filter(Boolean);
  const significant = words
    .slice(1)
    .filter((word) => !SMALL_WORDS.has(word.toLowerCase()) && STARTS_WITH_LETTER.test(word));
  if (significant.length < MIN_TITLE_CASE_WORDS) {
    return false;
  }

  const capitalized = significant.filter((word) => CAPITALIZED.test(word));
  return capitalized.length === significant.length;
}

function toSentenceCase(text) {
  return text.replace(
    CAPITALIZED_AFTER_SPACE,
    (_, first, others) => first.toLowerCase() + others,
  );
}
