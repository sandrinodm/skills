// Prose checks: marketing words, chat and summary phrases, leftover placeholders and scaffolder
// text, and em-dash density.

import { visibleText } from './markdown.mjs';

const MAX_EM_DASHES_PER_1000_WORDS = 5;
const MIN_EM_DASHES_FLAGGED = 5;
const WORDS_PER_THOUSAND = 1000;
const MAX_LISTED_EM_DASH_LINES = 8;

const EM_DASH = /\s—\s|\w—\w/;

// Words that almost never survive an edit by someone who knows the project. Each one either
// claims a quality without showing it or is a known model-era favourite.
const SLOP_WORDS = [
  'seamless',
  'seamlessly',
  'robust',
  'powerful',
  'blazing',
  'blazingly',
  'lightning-fast',
  'cutting-edge',
  'state-of-the-art',
  'best-in-class',
  'world-class',
  'next-generation',
  'game-changer',
  'game-changing',
  'revolutionary',
  'revolutionize',
  'revolutionise',
  'comprehensive',
  'leverage',
  'leverages',
  'leveraging',
  'utilize',
  'utilizes',
  'utilizing',
  'delve',
  'empower',
  'empowers',
  'empowering',
  'streamline',
  'streamlines',
  'streamlined',
  'elevate',
  'elevates',
  'harness',
  'effortless',
  'effortlessly',
  'supercharge',
  'supercharged',
  'unleash',
  'holistic',
  'pivotal',
  'meticulous',
  'meticulously',
  'showcase',
  'showcasing',
  'tapestry',
  'testament',
  'vibrant',
  'embark',
  'foster',
  'fostering',
  'paradigm',
  'synergy',
  'unparalleled',
  'unprecedented',
  'hassle-free',
  'frictionless',
  'intuitive',
  'delightful',
];

const SLOP_WORD_PATTERN = new RegExp(`\\b(${SLOP_WORDS.join('|')})\\b`, 'i');

const CHAT_PHRASE = 'chat phrase';
const MARKETING_PHRASE = 'marketing phrase';

const FALSE_RANGE = new RegExp(
  String.raw`\b(from|for) (prototypes?|side projects?|beginners?|startups?) ` +
    String.raw`to (production|enterprises?|experts?|large[- ]scale)\b`,
  'i',
);

// Each pattern with the label its finding gives. A line can match several.
const SLOP_PHRASES = [
  [/\bwhether you'?re (a |an )?\w+/i, 'false-breadth opener ("Whether you\'re ...")'],
  [/\bhappy (coding|hacking|building)\b/i, 'sign-off'],
  [/\bfeel free to\b/i, CHAT_PHRASE],
  [/\bdon'?t hesitate to\b/i, CHAT_PHRASE],
  [/\blet'?s (get started|dive in|dive into|begin)\b/i, CHAT_PHRASE],
  [/\b(in summary|in conclusion|to sum up)\b/i, 'summary closer'],
  [/\bnot (just|only|merely) [^.;]{1,60}?,? but\b/i, '"not just X, but Y" construction'],
  [
    /\bthis (section|document|readme|guide) (covers|describes|explains|walks|will|provides)\b/i,
    'sentence about the document instead of the project',
  ],
  [
    /\b(give (it|us|this repo) a|leave a) ?(⭐|star)|star (this|the) (repo|project)\b/i,
    'request for stars',
  ],
  [/\b(made|built|crafted) with (❤️|❤|love)\b/i, 'decorative sign-off'],
  [/\bto the next level\b/i, MARKETING_PHRASE],
  [/\blook no further\b/i, MARKETING_PHRASE],
  [
    /\bwith (performance|scalability|simplicity|developers?|security|flexibility) in mind\b/i,
    'claim without evidence ("with X in mind")',
  ],
  [
    /\bensuring (a |an )?(seamless|smooth|consistent|reliable)\b/i,
    'trailing "-ing" benefit clause',
  ],
  [FALSE_RANGE, 'false range'],
  [
    /\b(modern|today'?s) (developers?|teams|applications|web development)\b/i,
    'portable marketing phrase',
  ],
  [/\bout of the box\b.*\bout of the box\b/i, 'repeated phrase'],
];

const BRACKETED_PLACEHOLDER = 'bracketed placeholder';

const PLACEHOLDERS = [
  [
    /\[(your|insert|add|enter|describe|project|repo|package)[-_ ][^\]]*\](?![(\[:])/i,
    BRACKETED_PLACEHOLDER,
  ],
  [/<your[-_ ][a-z_ -]+>/i, 'angle-bracket placeholder'],
  [/\byour-(username|user|org|organization|repo|project|name|package)\b/i, 'placeholder name'],
  [/\b\d{4}-XX-XX\b/, 'placeholder date'],
  [/\blorem ipsum\b/i, 'placeholder text'],
  [/\b(oaicite|citeturn\d|contentReference\[)/, 'chat citation residue'],
];

// In code, `[dir]` and `<file>` are normal argument syntax, so only leftover names and dates
// count as placeholders there.
const CODE_PLACEHOLDERS = PLACEHOLDERS.filter(([, label]) => label !== BRACKETED_PLACEHOLDER);

const CREATE_NEXT_APP = 'create-next-app README';
const SCAFFOLDER = 'scaffolder README';

// Text that scaffolders write into a fresh README and nobody replaced.
const TEMPLATE_BOILERPLATE = [
  [/project bootstrapped with \[?`?create-next-app/i, CREATE_NEXT_APP],
  [
    /official starter Turborepo|This Turborepo (starter|includes the following)/i,
    'create-turbo README',
  ],
  [/This template provides a minimal setup to get React working in Vite/i, 'create-vite README'],
  [/Getting Started with Create React App/i, 'create-react-app README'],
  [/bootstrapped with \[?`?create-[a-z-]+/i, SCAFFOLDER],
  [/To learn more about Next\.js, take a look at the following resources/i, CREATE_NEXT_APP],
  [/Recommended IDE Setup\s*$/i, SCAFFOLDER],
  [/base shared `?tsconfig\.json`?'?s from which all other/i, 'create-turbo tsconfig README'],
  [/Collection of internal eslint configurations/i, 'create-turbo eslint-config README'],
];

/**
 * Reports slop-word, slop-phrase, placeholder, template-boilerplate and em-dashes.
 *
 * Slop words, phrases and em dashes are matched in the visible text (links become their label,
 * code and URLs are dropped); placeholders and boilerplate in the raw line, and placeholders in
 * code blocks too.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkProse(doc, add) {
  for (const { line, text } of doc.prose) {
    checkProseLine(line, text, add);
  }

  for (const block of doc.codeBlocks) {
    for (const { line, text } of block.lines) {
      checkCodePlaceholders(line, text, add);
    }
  }

  checkEmDashes(doc, add);
}

function checkProseLine(line, text, add) {
  const visible = visibleText(text);
  const word = visible.match(SLOP_WORD_PATTERN);
  if (word) {
    add(line, 'slop-word', `"${word[1]}": say what it does or show the number instead`);
  }

  for (const [pattern, label] of SLOP_PHRASES) {
    const match = visible.match(pattern);
    if (match) {
      add(line, 'slop-phrase', `${label}: "${match[0]}"`);
    }
  }

  for (const [pattern, label] of PLACEHOLDERS) {
    const match = text.match(pattern);
    if (match) {
      add(line, 'placeholder', `${label}: "${match[0]}"`);
    }
  }

  for (const [pattern, label] of TEMPLATE_BOILERPLATE) {
    if (pattern.test(text)) {
      add(
        line,
        'template-boilerplate',
        `${label} left in place; replace it with what this project is and how to run it`,
      );
    }
  }
}

function checkCodePlaceholders(line, text, add) {
  for (const [pattern, label] of CODE_PLACEHOLDERS) {
    const match = text.match(pattern);
    if (match) {
      add(line, 'placeholder', `${label} in a code block: "${match[0]}"`);
    }
  }
}

// A few em dashes are fine; the finding fires above MAX_EM_DASHES_PER_1000_WORDS, and never for
// fewer than MIN_EM_DASHES_FLAGGED, so a short README isn't flagged for two of them.
function checkEmDashes(doc, add) {
  const emDashLines = doc.prose
    .filter(({ text }) => EM_DASH.test(visibleText(text)))
    .map(({ line }) => line);
  const allowed = Math.max(
    MIN_EM_DASHES_FLAGGED - 1,
    Math.ceil((doc.wordCount / WORDS_PER_THOUSAND) * MAX_EM_DASHES_PER_1000_WORDS),
  );
  if (emDashLines.length <= allowed) {
    return;
  }

  const listed = emDashLines.slice(0, MAX_LISTED_EM_DASH_LINES).join(', ');
  const more = emDashLines.length > MAX_LISTED_EM_DASH_LINES ? ', ...' : '';
  add(
    emDashLines[0],
    'em-dashes',
    `${emDashLines.length} em dashes in ${doc.wordCount} words (lines ${listed}${more}); ` +
      'use periods, commas, colons or parentheses for most of them',
  );
}
