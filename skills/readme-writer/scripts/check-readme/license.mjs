// License checks: a License section needs a license file somewhere up to the repo root, and the
// license it names must match package.json.

import fs from 'node:fs';

import { headingLabel } from './markdown.mjs';
import { squash } from './names.mjs';

const LICENSE_SECTION = /^licen[cs]e/i;
const LICENSE_FILE = /^(licen[cs]e|copying)(\.|-|$)/i;
const LICENSE_NAMES = new RegExp(
  String.raw`\b(` +
    [
      'MIT',
      'ISC',
      String.raw`Apache[- ]2\.0`,
      'Apache License',
      'BSD[- ]?[23]-Clause',
      'BSD',
      'GPL-?[23]',
      'LGPL',
      'AGPL',
      String.raw`MPL-?2\.0`,
      'Unlicense',
      'CC0',
    ].join('|') +
    String.raw`)\b`,
);

/**
 * Reports missing-license-file and license-mismatch for the first License heading. The license
 * named is the first known license name on a prose line below that heading; the comparison
 * ignores case, punctuation and the word "license", and accepts either name containing the other
 * ("Apache-2.0" and "Apache License").
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkLicense(doc, project, add) {
  const heading = doc.headings.find((candidate) =>
    LICENSE_SECTION.test(headingLabel(candidate.text)),
  );
  if (!heading) {
    return;
  }

  checkLicenseFile(heading, project, add);
  checkLicenseName(doc, heading, project, add);
}

function checkLicenseFile(heading, project, add) {
  const searchDirs = [
    project.dir,
    project.packageDir,
    project.workspaceRoot,
    project.repoRoot,
  ].filter(Boolean);
  const licenseFile = searchDirs.map((dir) => findLicenseFile(dir)).find(Boolean);
  if (!licenseFile) {
    add(
      heading.line,
      'missing-license-file',
      'no LICENSE file in the package or repo; ask the maintainer to add one, ' +
        'and meanwhile name the license without linking a file',
    );
  }
}

function checkLicenseName(doc, heading, project, add) {
  const declared = project.manifest?.license;
  const licenseLine = doc.prose.find(
    ({ line, text }) => line > heading.line && LICENSE_NAMES.test(text),
  );
  if (!licenseLine || !declared || typeof declared !== 'string') {
    return;
  }

  const named = licenseLine.text.match(LICENSE_NAMES)[1];
  const matches =
    normalizeLicense(declared).includes(normalizeLicense(named)) ||
    normalizeLicense(named).includes(normalizeLicense(declared));
  if (!matches) {
    add(
      licenseLine.line,
      'license-mismatch',
      `README says ${named} but package.json says ${declared}`,
    );
  }
}

function normalizeLicense(value) {
  return squash(value).replace('license', '').replace('apache20', 'apache');
}

function findLicenseFile(dir) {
  try {
    return fs.readdirSync(dir).find((name) => LICENSE_FILE.test(name)) ?? null;
  } catch {
    return null;
  }
}
