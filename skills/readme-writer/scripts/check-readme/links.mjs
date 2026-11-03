// Link checks: relative links must point at a file in the repo, and `#anchor` links at a heading
// or an HTML id in the same README.

import fs from 'node:fs';
import path from 'node:path';

import { stripHtml } from './markdown.mjs';
import { decodeUrlPart } from './names.mjs';

// `[text](target "title")` and `![alt](<target>)`, `<a href>` and `<img src>`, and reference
// definitions (`[label]: target`). Each alternative captures the target in its own group.
const MARKDOWN_LINK = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/;
const HTML_LINK = /<(?:a|img)[^>]+(?:href|src)="([^"]+)"/;
const REFERENCE_DEFINITION = /^\s*\[[^\]]+\]:\s*(\S+)/;
const LINK_TARGET = new RegExp(
  [MARKDOWN_LINK, HTML_LINK, REFERENCE_DEFINITION].map((pattern) => pattern.source).join('|'),
  'g',
);

const EXTERNAL_TARGET = /^(https?:|mailto:|tel:|data:|\/\/)/i;
const HTML_ANCHOR = /<a[^>]+(?:name|id)="([^"]+)"|\sid="([^"]+)"/g;

const SLUG_IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const SLUG_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const SLUG_EMPHASIS = /[`*_~]/g;
const SLUG_PUNCTUATION = /[^\p{L}\p{N}\s_-]/gu;
const SLUG_WHITESPACE = /\s/g;

/**
 * Reports broken-anchor and broken-link. External URLs aren't fetched. A path starting with `/`
 * resolves from the repo root, any other from the README's folder; the query and `#fragment` of
 * a file link are ignored.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 * @throws {URIError} When a link target has a malformed percent escape.
 */
export function checkLinks(doc, project, add) {
  const anchors = collectAnchors(doc);

  for (const { line, text } of doc.prose) {
    for (const match of text.matchAll(LINK_TARGET)) {
      const target = (match[1] ?? match[2] ?? match[3]).trim();
      if (EXTERNAL_TARGET.test(target)) {
        continue;
      }

      if (target.startsWith('#')) {
        checkAnchor(target, line, anchors, add);
      } else {
        checkFileLink(target, line, project, add);
      }
    }
  }
}

function checkAnchor(target, line, anchors, add) {
  const anchor = decodeUrlPart(target.slice(1)).toLowerCase();
  if (anchor && !anchors.has(anchor)) {
    add(line, 'broken-anchor', `link to "#${anchor}" but no heading produces that anchor`);
  }
}

function checkFileLink(target, line, project, add) {
  const filePart = decodeUrlPart(target.split('#')[0].split('?')[0]);
  const resolved = filePart.startsWith('/')
    ? path.join(project.repoRoot, filePart)
    : path.resolve(project.dir, filePart);
  if (!fs.existsSync(resolved)) {
    add(
      line,
      'broken-link',
      `"${target}" doesn't exist (resolved to ${path.relative(process.cwd(), resolved) || '.'})`,
    );
  }
}

// The anchors GitHub generates for the headings, numbering repeats (`usage`, `usage-1`), plus
// every `<a name>` and `id` attribute in the file.
function collectAnchors(doc) {
  const anchors = new Set();
  const seen = new Map();

  for (const heading of doc.headings) {
    const base = githubSlug(heading.text);
    const count = seen.get(base) ?? 0;
    anchors.add(count === 0 ? base : `${base}-${count}`);
    seen.set(base, count + 1);
  }

  for (const line of doc.lines) {
    for (const match of line.matchAll(HTML_ANCHOR)) {
      anchors.add((match[1] ?? match[2]).toLowerCase());
    }
  }

  return anchors;
}

function githubSlug(text) {
  return stripHtml(text)
    .replace(SLUG_IMAGE, '')
    .replace(SLUG_LINK, '$1')
    .replace(SLUG_EMPHASIS, '')
    .trim()
    .toLowerCase()
    .replace(SLUG_PUNCTUATION, '')
    .replace(SLUG_WHITESPACE, '-');
}
