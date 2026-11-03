// List checks: runs of "**Label**: text" bullets and of bullets that start with an emoji.

import { visibleText } from './markdown.mjs';

const MIN_BOLD_LABEL_BULLETS = 3;
const MIN_EMOJI_BULLETS = 3;
const MIN_WORDS_AFTER_LABEL = 3;

const BULLET = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/;
const STARTS_WITH_EMOJI = /^\p{Extended_Pictographic}/u;
// "**Label**: text", "**Label** — text", "**Label** - text", each optionally after an emoji.
const BOLD_LABEL_THEN_SEPARATOR =
  /^(?:\p{Extended_Pictographic}\uFE0F?\s*)?\*\*([^*]+?)\*\*\s*(:|—|–|-\s)\s*(.*)$/u;
// "**Label:** text", with the colon inside the bold.
const BOLD_LABEL_WITH_COLON =
  /^(?:\p{Extended_Pictographic}\uFE0F?\s*)?\*\*([^*]+?):\*\*()\s*(.*)$/u;
const IDENTIFIER_LABEL = /^[a-z0-9_./@-]+$/;
const WHITESPACE = /\s+/;
const HAS_LETTER = /\p{L}/u;

/**
 * Reports bold-label-list and emoji-bullets for each run of consecutive bullets, at the run's
 * first line. Blank lines don't end a run; any other non-bullet line does.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkLists(doc, add) {
  let run = emptyRun();

  for (const { line, text } of doc.prose) {
    const bullet = text.match(BULLET);
    if (!bullet) {
      if (text.trim() !== '') {
        reportRun(run, add);
        run = emptyRun();
      }

      continue;
    }

    const body = bullet[1];
    if (isBoldLabelBullet(body)) {
      run.boldLabelLines.push(line);
    }

    if (STARTS_WITH_EMOJI.test(body)) {
      run.emojiLines.push(line);
    }
  }

  reportRun(run, add);
}

function emptyRun() {
  return { boldLabelLines: [], emojiLines: [] };
}

function reportRun({ boldLabelLines, emojiLines }, add) {
  if (boldLabelLines.length >= MIN_BOLD_LABEL_BULLETS) {
    add(
      boldLabelLines[0],
      'bold-label-list',
      `${boldLabelLines.length} bullets shaped "**Label**: text"; ` +
        'rewrite as plain bullets that say what each thing does ' +
        '(fine to keep for key: value reference entries such as option names)',
    );
  }

  if (emojiLines.length >= MIN_EMOJI_BULLETS) {
    add(
      emojiLines[0],
      'emoji-bullets',
      `${emojiLines.length} bullets that start with an emoji; drop the emoji`,
    );
  }
}

// "**Fast**: Built for speed." is the generated shape: a quality as the label, then a sentence
// that restates it. A reference list ("**cat** - Concatenate files", "**ES Module**: `dist/x.mjs`")
// has an identifier as the label or only a value after it, and is fine.
function isBoldLabelBullet(body) {
  const match = body.match(BOLD_LABEL_THEN_SEPARATOR) ?? body.match(BOLD_LABEL_WITH_COLON);
  if (!match) {
    return false;
  }

  const [, label, , rest] = match;
  const isIdentifier = IDENTIFIER_LABEL.test(label.trim());
  const restWords = visibleText(rest)
    .split(WHITESPACE)
    .filter((word) => HAS_LETTER.test(word));
  return !isIdentifier && restWords.length >= MIN_WORDS_AFTER_LABEL;
}
