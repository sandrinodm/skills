// A sentence copied into several sibling READMEs is either a template that nobody adapted or
// shared text (a sales block, a cross-sell) that belongs in one place.

import { byLine, createFinding } from './findings.mjs';
import { visibleText } from './markdown.mjs';

const MIN_COPIES = 3;
const MIN_COPIED_SENTENCE_WORDS = 8;
const MAX_SENTENCE_PREVIEW_CHARS = 70;

const SENTENCE_END = /(?<=[.!?])\s+/;
const WHITESPACE_RUN = /\s+/g;

/**
 * Adds a copied-sentence note for each sentence of at least MIN_COPIED_SENTENCE_WORDS words that
 * appears in MIN_COPIES or more of the READMEs, to each of those reports at the sentence's first
 * line. Sentences are compared lowercased with whitespace collapsed, then each report's
 * findings are sorted by line again. With fewer than MIN_COPIES reports nothing happens.
 *
 * @param {import('./check-readmes.mjs').ParsedReport[]} reports Changed in place.
 * @returns {void}
 */
export function checkCopiedSentences(reports) {
  if (reports.length < MIN_COPIES) {
    return;
  }

  for (const [sentence, places] of sentencePlaces(reports)) {
    if (places.length < MIN_COPIES) {
      continue;
    }

    for (const { report, line } of places) {
      report.findings.push(
        createFinding(
          line,
          'copied-sentence',
          `same sentence in ${places.length} of the READMEs checked: "${preview(sentence)}"`,
        ),
      );
    }
  }

  for (const report of reports) {
    report.findings.sort(byLine);
  }
}

// Every sentence, with the reports it appears in and its first line in each, in the order the
// sentences are first seen.
function sentencePlaces(reports) {
  const places = new Map();

  for (const report of reports) {
    for (const [sentence, line] of longSentences(report.doc)) {
      places.set(sentence, [...(places.get(sentence) ?? []), { report, line }]);
    }
  }

  return places;
}

// The README's long sentences, each mapped to the first line it appears on. A sentence that
// wraps onto the next line is split there.
function longSentences(doc) {
  const sentences = new Map();

  for (const { line, text } of doc.prose) {
    for (const sentence of visibleText(text).split(SENTENCE_END)) {
      const normalized = sentence.trim().toLowerCase().replace(WHITESPACE_RUN, ' ');
      const isLong = normalized.split(' ').length >= MIN_COPIED_SENTENCE_WORDS;
      if (isLong && !sentences.has(normalized)) {
        sentences.set(normalized, line);
      }
    }
  }

  return sentences;
}

function preview(sentence) {
  const shortened = sentence.slice(0, MAX_SENTENCE_PREVIEW_CHARS);
  return sentence.length > MAX_SENTENCE_PREVIEW_CHARS ? `${shortened}...` : shortened;
}
