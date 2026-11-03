// Package checks for a README next to its package.json: the H1 and install commands use the
// package's real name, a private package isn't installed from npm, a published package shows its
// name, and "zero dependencies" is true.

import path from 'node:path';

import { visibleText } from './markdown.mjs';
import { squash } from './names.mjs';
import { checkImports } from './package-exports.mjs';

// An H1 like "cal-react" or "@turbo/eslint-config".
const PACKAGE_NAME_HEADING = /^@?[a-z0-9._-]+(\/[a-z0-9._-]+)?$/;
const INSTALL_COMMAND =
  /^\s*\$?\s*(?:npm (?:install|i|add)|pnpm add|yarn add|bun add)\s+(?!-)([^\n#]+)/gm;
const WHITESPACE = /\s+/;
const VERSION_SUFFIX = /(?<=.)@[^/]*$/;
const NO_DEPENDENCIES_CLAIM = /\b(zero|no)[- ](runtime )?dependenc|dependency[- ]free\b/i;
const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const SCOPE_SEPARATOR = '/';

/**
 * Reports wrong-package-name, private-install, no-install and false-claim, and missing-export
 * through package-exports.mjs. Only runs when the README sits in the folder of a named
 * package.json. A private package gets only the heading and private-install checks.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkPackage(doc, project, add) {
  const manifest = project.manifest;
  if (!manifest?.name || project.packageDir !== project.dir) {
    return;
  }

  const code = doc.codeBlocks.flatMap((block) => block.lines.map(({ text }) => text)).join('\n');
  checkTitle(doc, project, add);

  if (manifest.private) {
    checkPrivateInstall(doc, code, manifest, add);

    return;
  }

  checkNameShown(doc, code, manifest, add);
  checkInstallNames(doc, code, project, add);
  checkNoDependenciesClaim(doc, manifest, add);
  checkImports(doc, project, add);
}

// In a monorepo an H1 that looks like a package name must be this package's name.
function checkTitle(doc, project, add) {
  const title = doc.headings.find((heading) => heading.level === 1);
  if (!title || project.workspaces.length === 0) {
    return;
  }

  const titleText = visibleText(title.text).trim();
  const name = project.manifest.name;
  if (PACKAGE_NAME_HEADING.test(titleText) && titleText !== name) {
    add(
      title.line,
      'wrong-package-name',
      `heading says ${titleText} but package.json names this package ${name}`,
    );
  }
}

function checkPrivateInstall(doc, code, manifest, add) {
  const install = code.match(privateInstallPattern(manifest.name));
  if (!install) {
    return;
  }

  const command = install[0].trim();
  add(
    lineContaining(doc, command),
    'private-install',
    `${manifest.name} is private (not published), so "${command}" fails outside the workspace; ` +
      'use "workspace:*" or drop the install step',
  );
}

// An install of exactly this package, at the start of a code line.
function privateInstallPattern(name) {
  return new RegExp(
    String.raw`^\s*\$?\s*(?:npm (?:install|i)|pnpm add|yarn add|bun add)\s[^\n]*` +
      `${escapeRegExp(name)}(?![\\w/-])`,
    'm',
  );
}

function checkNameShown(doc, code, manifest, add) {
  const prose = doc.prose.map(({ text }) => text).join('\n');
  if (!code.includes(manifest.name) && !prose.includes(`\`${manifest.name}`)) {
    add(
      1,
      'no-install',
      `published package "${manifest.name}" but the README never shows the name ` +
        'in an install command or import',
    );
  }
}

// An install command that names something close to this package (same scope, the folder name,
// the name without punctuation) but not the package itself.
function checkInstallNames(doc, code, project, add) {
  const name = project.manifest.name;

  for (const [full, list] of code.matchAll(INSTALL_COMMAND)) {
    const names = list
      .split(WHITESPACE)
      .filter((word) => word && !word.startsWith('-'))
      .map((word) => word.replace(VERSION_SUFFIX, ''));
    const isMisnamed =
      names.length > 0 &&
      !names.includes(name) &&
      names.some((candidate) => looksLikePackage(candidate, name, project.dir));
    if (isMisnamed) {
      add(
        lineContaining(doc, full.trim()),
        'wrong-package-name',
        `install command uses ${names.join(' ')} but the package is published as ${name}`,
      );
    }
  }
}

function looksLikePackage(candidate, name, packageDir) {
  const [scope] = name.split(SCOPE_SEPARATOR);
  return (
    candidate.startsWith(`${scope}/`) ||
    candidate === path.basename(packageDir) ||
    squash(candidate) === squash(name) ||
    squash(candidate) === squash(name.split(SCOPE_SEPARATOR).pop())
  );
}

function checkNoDependenciesClaim(doc, manifest, add) {
  const dependencies = Object.keys(manifest.dependencies ?? {});
  const claim = doc.prose.find(({ text }) => NO_DEPENDENCIES_CLAIM.test(visibleText(text)));
  if (claim && dependencies.length > 0) {
    add(
      claim.line,
      'false-claim',
      `claims no dependencies, but package.json lists ${dependencies.join(', ')}`,
    );
  }
}

// The first README line that contains the text, or line 1 when no single line does.
function lineContaining(doc, text) {
  return doc.lines.findIndex((line) => line.includes(text)) + 1 || 1;
}

function escapeRegExp(text) {
  return text.replace(REGEXP_SPECIAL_CHARACTERS, '\\$&');
}
