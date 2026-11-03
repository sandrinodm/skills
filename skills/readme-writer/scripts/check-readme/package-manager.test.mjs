import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

function shell(...commands) {
  return readme('```sh', ...commands, '```');
}

describe('checkPackageManager', () => {
  it('reports commands for a package manager other than the lockfile one', () => {
    const findings = findingsFor({
      'README.md': shell('$ npm install', 'yarn build', 'pnpm build'),
      'package.json': { name: 'tool', private: true, scripts: { build: 'tsc' } },
      'pnpm-lock.yaml': '',
    });
    assert.deepEqual(
      withRule(findings, 'wrong-package-manager').map(({ line, message }) => [line, message]),
      [
        [2, 'the repo uses pnpm (pnpm-lock.yaml) but this command uses npm'],
        [3, 'the repo uses pnpm (pnpm-lock.yaml) but this command uses yarn'],
      ],
    );
  });

  it('allows installs of a published package, global installs and one-off runners', () => {
    const findings = findingsFor({
      'README.md': shell('npm install tool', 'npm i -g tool', 'yarn dlx tool', 'bun create tool'),
      'package.json': { name: 'tool' },
      'pnpm-lock.yaml': '',
    });
    assert.deepEqual(withRule(findings, 'wrong-package-manager'), []);
  });

  it('reports a bare install even in a published package', () => {
    const findings = findingsFor({
      'README.md': shell('npm install'),
      'package.json': { name: 'tool' },
      'bun.lock': '',
    });
    assert.equal(withRule(findings, 'wrong-package-manager').length, 1);
  });

  it('reports npm --filter with or without a lockfile', () => {
    const findings = findingsFor({ 'README.md': shell('npm run build --filter=web') });
    assert.deepEqual(withRule(findings, 'npm-filter'), [
      {
        line: 2,
        level: 'error',
        rule: 'npm-filter',
        message:
          'npm has no --filter; ' +
          `use "npm run <script> -w <workspace>" or the repo's own package manager`,
      },
    ]);
  });
});
