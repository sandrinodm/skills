import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

const SHIELD = 'https://img.shields.io';

function badge(url, link) {
  return link ? `[![badge](${url})](${link})` : `![badge](${url})`;
}

function styleFindings(text) {
  return findingsFor({ 'README.md': text }, { styleOnly: true });
}

function repoFindings(text, files = {}) {
  return findingsFor({
    'README.md': text,
    'package.json': {
      name: 'ttl-memo',
      license: 'MIT',
      repository: 'https://github.com/acme/ttl-memo.git',
    },
    ...files,
  });
}

describe('checkBadges', () => {
  it('reports more than six badges at the first one', () => {
    const badges = Array.from({ length: 7 }, (_, index) => badge(`${SHIELD}/npm/dm/x${index}`));
    const findings = styleFindings(readme('# Tool', badges.join(' ')));
    assert.deepEqual(
      withRule(findings, 'badge-wall').map(({ line, message }) => [line, message]),
      [[2, '7 badges; keep the few a reader acts on (version, CI, license) and drop the rest']],
    );
  });

  it('reports static badges that imitate live status', () => {
    const findings = styleFindings(badge(`${SHIELD}/badge/build-passing-green`));
    assert.equal(
      withRule(findings, 'static-status-badge')[0].message,
      `static badge that imitates live status (${SHIELD}/badge/build-passing-green); ` +
        'link a real CI or coverage badge or drop it',
    );
  });

  it('reports language and star badges as vanity badges', () => {
    const findings = styleFindings(
      readme(
        badge(`${SHIELD}/badge/made%20with-TypeScript-blue`),
        badge(`${SHIELD}/github/stars/a/b`),
      ),
    );
    assert.deepEqual(
      withRule(findings, 'vanity-badge').map(({ line }) => line),
      [1, 2],
    );
  });
});

describe('checkBadgeFacts', () => {
  it('reports npm badges for another package and suggests a version badge', () => {
    const findings = repoFindings(badge(`${SHIELD}/npm/dm/other-pkg.svg`));
    assert.deepEqual(
      withRule(findings, 'badge-wrong-package').map(({ message }) => message),
      ['badge is for "other-pkg" but this package is ttl-memo'],
    );
    assert.equal(withRule(findings, 'no-npm-badge').length, 1);
  });

  it('accepts a version badge for this package', () => {
    const findings = repoFindings(
      badge(`${SHIELD}/npm/v/ttl-memo`, 'https://www.npmjs.com/package/ttl-memo'),
    );
    assert.deepEqual(withRule(findings, 'badge-wrong-package'), []);
    assert.deepEqual(withRule(findings, 'no-npm-badge'), []);
  });

  it('reports CI badges for a missing workflow or another repo', () => {
    const findings = repoFindings(
      badge('https://github.com/other/fork/actions/workflows/release.yml/badge.svg'),
      { '.github/workflows/ci.yml': 'name: CI\n' },
    );
    assert.deepEqual(
      [...withRule(findings, 'missing-workflow'), ...withRule(findings, 'badge-wrong-repo')].map(
        ({ message }) => message,
      ),
      [
        'CI badge for workflow "release.yml" but .github/workflows has ci.yml',
        'CI badge points at other/fork but package.json says the repository is acme/ttl-memo',
      ],
    );
  });

  it('matches a CI badge by the workflow name too', () => {
    const findings = repoFindings(
      badge('https://github.com/acme/ttl-memo/workflows/CI/badge.svg'),
      { '.github/workflows/test.yaml': "name: 'CI'\non: push\n" },
    );
    assert.deepEqual(withRule(findings, 'missing-workflow'), []);
    assert.deepEqual(withRule(findings, 'badge-wrong-repo'), []);
  });

  it('reports a static license badge that contradicts package.json', () => {
    const findings = repoFindings(badge(`${SHIELD}/badge/license-Apache_2.0-blue`));
    assert.deepEqual(
      withRule(findings, 'license-mismatch').map(({ message }) => message),
      ['license badge says Apache 2.0 but package.json says MIT'],
    );
  });
});
