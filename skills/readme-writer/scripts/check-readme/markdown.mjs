// Splits a README into prose lines, code blocks and headings, and turns Markdown into the text a
// reader sees. This is a line-based reader, not a full CommonMark parser: it only needs to keep
// code and comments out of the prose checks and to find the headings.

/**
 * @typedef {{ line: number, text: string }} SourceLine
 * @typedef {{ line: number, level: number, text: string }} Heading
 * @typedef {{ marker: string, lang: string, start: number, lines: SourceLine[] }} CodeBlock
 * @typedef {{
 *   lines: string[],
 *   headings: Heading[],
 *   codeBlocks: CodeBlock[],
 *   prose: SourceLine[],
 *   wordCount: number,
 * }} Doc
 */

const LINE_BREAK = /\r?\n/;
const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+-]*)/;
const ATX_HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const SETEXT_UNDERLINE = /^(=+|-+)\s*$/;
const BULLET_START = /^\s*[-*+]\s/;
const HTML_HEADING = /<h([1-6])[^>]*>(.*?)<\/h\1>/i;
const INLINE_COMMENT = /<!--.*?-->/g;
const COMMENT_START = '<!--';
const COMMENT_END = '-->';

const HTML_TAG = /<[^>]+>/g;
const INLINE_CODE = /`[^`]*`/g;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
const BARE_URL = /https?:\/\/\S+/g;
const WHITESPACE = /\s+/;
const EMOJI_OR_VARIATION_SELECTOR = /[\p{Extended_Pictographic}\uFE0F]/gu;
const LEADING_SYMBOLS = /^[^\p{L}\p{N}]+/u;

// Fence info strings that mark a block a reader would paste into a terminal. An unlabelled block
// counts, since most READMEs leave install commands unlabelled.
const SHELL_LANGUAGES = new Set([
  '',
  'sh',
  'bash',
  'shell',
  'console',
  'zsh',
  'terminal',
  'shell-session',
  'fish',
  'powershell',
  'ps1',
  'cmd',
]);

/**
 * Reads a README line by line. Fenced code goes to `codeBlocks` (an unclosed fence runs to the end
 * of the file), lines inside multi-line HTML comments are dropped, ATX, setext and `<hN>` headings
 * go to `headings`, and every other line goes to `prose` with inline comments removed. An `<hN>`
 * line is both a heading and prose.
 *
 * @param {string} text The README's contents.
 * @returns {Doc} Line numbers are 1-based.
 */
export function parseMarkdown(text) {
  const lines = text.split(LINE_BREAK);
  const headings = [];
  const codeBlocks = [];
  const prose = [];
  const doc = { lines, headings, codeBlocks, prose };
  const state = { fence: null, inComment: false, previous: '' };

  lines.forEach((raw, index) => readLine(doc, state, raw, index + 1));

  if (state.fence) {
    codeBlocks.push(state.fence);
  }

  const wordCount = prose.reduce((count, entry) => count + countWords(entry.text), 0);
  return { lines, headings, codeBlocks, prose, wordCount };
}

/**
 * The text a reader sees: HTML tags, inline code, images and bare URLs become spaces, and links
 * become their label.
 *
 * @param {string} text One line of Markdown.
 * @returns {string}
 */
export function visibleText(text) {
  return stripHtml(text)
    .replace(INLINE_CODE, ' ')
    .replace(IMAGE, ' ')
    .replace(LINK, '$1')
    .replace(BARE_URL, ' ');
}

/**
 * Replaces every HTML tag with a space.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripHtml(text) {
  return text.replace(HTML_TAG, ' ');
}

/**
 * The words of a heading without emoji or leading symbols, for matching section names such as
 * "License" or "Contributing".
 *
 * @param {string} text The heading's Markdown text.
 * @returns {string}
 */
export function headingLabel(text) {
  return visibleText(text)
    .replace(EMOJI_OR_VARIATION_SELECTOR, '')
    .replace(LEADING_SYMBOLS, '')
    .trim();
}

/**
 * Counts the words a reader sees in a line or paragraph of Markdown.
 *
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  return visibleText(text).split(WHITESPACE).filter(Boolean).length;
}

/**
 * True for a code block whose commands a reader would run in a terminal.
 *
 * @param {CodeBlock} block
 * @returns {boolean}
 */
export function isShellBlock(block) {
  return SHELL_LANGUAGES.has(block.lang);
}

function readLine(doc, state, raw, line) {
  const fenceMatch = raw.match(FENCE);

  if (state.fence) {
    if (closesFence(state.fence, fenceMatch, raw)) {
      doc.codeBlocks.push(state.fence);
      state.fence = null;
    } else {
      state.fence.lines.push({ line, text: raw });
    }

    return;
  }

  if (fenceMatch) {
    state.fence = openFence(fenceMatch, line);

    return;
  }

  if (state.inComment) {
    if (raw.includes(COMMENT_END)) {
      state.inComment = false;
    }

    return;
  }

  if (raw.includes(COMMENT_START) && !raw.includes(COMMENT_END)) {
    state.inComment = true;

    return;
  }

  readContentLine(doc, raw, line, state.previous);
  state.previous = raw;
}

function openFence([, marker, lang], line) {
  return { marker, lang: lang.toLowerCase(), start: line, lines: [] };
}

// A fence closes on a line holding only a run of the same character, at least as long as the one
// that opened it.
function closesFence(fence, fenceMatch, raw) {
  if (!fenceMatch) {
    return false;
  }

  const [, marker] = fenceMatch;
  const sameCharacter = marker[0] === fence.marker[0];
  const longEnough = marker.length >= fence.marker.length;
  const markerOnly = raw.trim() === marker;
  return sameCharacter && longEnough && markerOnly;
}

function readContentLine(doc, raw, line, previous) {
  const atx = raw.match(ATX_HEADING);
  if (atx) {
    doc.headings.push({ line, level: atx[1].length, text: atx[2] });

    return;
  }

  // A `---` or `===` under a text line turns that line into a heading. Under a list item or a
  // blank line it's prose (a horizontal rule). The underline itself is never prose.
  if (SETEXT_UNDERLINE.test(raw) && previous.trim() !== '' && !BULLET_START.test(previous)) {
    promoteToSetextHeading(doc, raw, line, previous);

    return;
  }

  const htmlHeading = raw.match(HTML_HEADING);
  if (htmlHeading) {
    doc.headings.push({ line, level: Number(htmlHeading[1]), text: stripHtml(htmlHeading[2]) });
  }

  doc.prose.push({ line, text: raw.replace(INLINE_COMMENT, '') });
}

// The underlined line only becomes a heading when it was read as prose just above; after a code
// block or a comment nothing is promoted.
function promoteToSetextHeading(doc, raw, line, previous) {
  const last = doc.prose[doc.prose.length - 1];
  if (!last || last.line !== line - 1) {
    return;
  }

  doc.prose.pop();
  doc.headings.push({ line: line - 1, level: raw.startsWith('=') ? 1 : 2, text: previous.trim() });
}
