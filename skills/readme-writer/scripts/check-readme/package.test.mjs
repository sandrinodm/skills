import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

function shell(...commands) {
  return readme('```sh', ...commands, '```');
}

// A package README inside a pnpm monorepo.
function packageFindings(text, manifest) {
  return findingsFor(
    {
      'package.json': { name: 'acme', private: true },
      'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n",
      'packages/ui/README.md': text,
      'packages/ui/package.json': manifest,
    },
    { readmePath: 'packages/ui/README.md' },
  );
}

describe('checkPackage', () => {
  it('reports an H1 that names another package', () => {
    const findings = packageFindings(readme('# acme-ui', '', 'Components.'), {
      name: '@acme/ui',
      private: true,
    });
    assert.deepEqual(withRule(findings, 'wrong-package-name'), [
      {
        line: 1,
        level: 'error',
        rule: 'wrong-package-name',
        message: 'heading says acme-ui but package.json names this package @acme/ui',
      },
    ]);
  });

  it('reports an npm install of a private package at its line', () => {
    const findings = packageFindings(readme('# @acme/ui', '', shell('pnpm add @acme/ui')), {
      name: '@acme/ui',
      private: true,
    });
    assert.deepEqual(
      withRule(findings, 'private-install').map(({ line, message }) => [line, message]),
      [
        [
          4,
          '@acme/ui is private (not published), so "pnpm add @acme/ui" fails outside the ' +
            'workspace; use "workspace:*" or drop the install step',
        ],
      ],
    );
  });

  it('notes a published package whose name never appears', () => {
    const findings = packageFindings('# UI\n\nComponents.', { name: '@acme/ui' });
    assert.equal(withRule(findings, 'no-install').length, 1);
  });

  it('reports install commands that use a similar but wrong name', () => {
    const findings = packageFindings(shell('npm install acme-ui@2 react', 'npm i @acme/ui'), {
      name: '@acme/ui',
    });
    assert.deepEqual(
      withRule(findings, 'wrong-package-name').map(({ line, message }) => [line, message]),
      [[2, 'install command uses acme-ui react but the package is published as @acme/ui']],
    );
  });

  it('reports a "zero dependencies" claim when package.json has dependencies', () => {
    const findings = packageFindings(readme('`@acme/ui` has zero dependencies.'), {
      name: '@acme/ui',
      dependencies: { react: '^19.0.0', clsx: '^2.0.0' },
    });
    assert.deepEqual(
      withRule(findings, 'false-claim').map(({ message }) => message),
      ['claims no dependencies, but package.json lists react, clsx'],
    );
  });

  it('skips a README that is not next to its package.json', () => {
    const findings = findingsFor(
      {
        'package.json': { name: 'tool', dependencies: { zod: '1' } },
        'docs/README.md': 'Zero dependencies.',
      },
      { readmePath: 'docs/README.md' },
    );
    assert.deepEqual(withRule(findings, 'false-claim'), []);
  });
});
