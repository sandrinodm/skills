import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

function shell(...commands) {
  return readme('```sh', ...commands, '```');
}

// A pnpm workspace with two packages and a turbo.json, checked from its root README. The
// packages are listed one by one so they keep that order in messages.
function workspaceFindings(...commands) {
  return findingsFor({
    'README.md': shell(...commands),
    'package.json': { name: 'acme', private: true, scripts: { dev: 'turbo dev' } },
    'pnpm-workspace.yaml': "packages:\n  - 'apps/web'\n  - \"apps/api\"\n",
    'pnpm-lock.yaml': '',
    'turbo.json': { tasks: { build: {}, 'web#dev': {} } },
    'apps/web/package.json': { name: '@acme/web', scripts: { dev: 'vite' } },
    'apps/api/package.json': { name: '@acme/api', scripts: { start: 'node .' } },
  });
}

describe('checkPackageManagerCommand', () => {
  it('reports npm scripts that the package does not define', () => {
    const findings = findingsFor({
      'README.md': shell('npm run lint', 'npm test', 'npm run build', 'npm install -D vitest'),
      'package.json': { name: 'tool', scripts: { build: 'tsc' } },
    });
    assert.deepEqual(
      withRule(findings, 'missing-script').map(({ message }) => message),
      ['"lint" isn\'t a script in tool', '"test" isn\'t a script in tool'],
    );
  });

  it('accepts a binary from node_modules/.bin for pnpm but not for npm', () => {
    const findings = findingsFor({
      'README.md': shell('pnpm vitest', 'npm vitest', 'npm run vitest'),
      'package.json': { name: 'tool' },
      'node_modules/.bin/vitest': '',
    });
    assert.deepEqual(
      withRule(findings, 'missing-script').map(({ line }) => line),
      [4],
    );
  });

  it('skips builtins, package specs and variables', () => {
    const findings = findingsFor({
      'README.md': shell('pnpm add zod', 'pnpm dlx create-x', 'yarn @scope/pkg', 'pnpm $TASK'),
      'package.json': { name: 'tool' },
    });
    assert.deepEqual(withRule(findings, 'missing-script'), []);
  });

  it('looks scripts up in the filtered workspace packages', () => {
    const findings = workspaceFindings(
      'pnpm --filter @acme/web dev',
      'pnpm -F=./apps/api dev',
      'pnpm --filter "@acme/*" build',
      'pnpm --filter "./apps/w*" start',
    );
    assert.deepEqual(
      withRule(findings, 'missing-script').map(({ message }) => message),
      [
        '"dev" isn\'t a script in @acme/api',
        '"build" isn\'t a script in @acme/web, @acme/api',
        '"start" isn\'t a script in @acme/web',
      ],
    );
  });

  it('reports filters that match no workspace package', () => {
    const findings = workspaceFindings('pnpm --filter docs dev', 'yarn workspace @acme/cli build');
    assert.deepEqual(
      withRule(findings, 'missing-workspace').map(({ message }) => message),
      [
        '--filter "docs" matches no workspace package (have: @acme/web, @acme/api, acme)',
        '--filter "@acme/cli" matches no workspace package (have: @acme/web, @acme/api, acme)',
      ],
    );
  });

  it('skips commands that run in every package or use dynamic filters', () => {
    const findings = workspaceFindings('pnpm -r lint', 'pnpm --filter "[origin/main]" lint');
    assert.deepEqual(withRule(findings, 'missing-script'), []);
    assert.deepEqual(withRule(findings, 'missing-workspace'), []);
  });
});

describe('checkTurboCommand', () => {
  it('reports tasks that turbo.json does not define, ignoring package prefixes', () => {
    const findings = workspaceFindings('turbo run build dev lint', 'npx turbo test --filter=web');
    assert.deepEqual(
      withRule(findings, 'missing-task').map(({ line, message }) => [line, message]),
      [
        [2, '"lint" isn\'t a task in turbo.json'],
        [3, '"test" isn\'t a task in turbo.json'],
      ],
    );
    assert.deepEqual(
      withRule(findings, 'missing-workspace').map(({ line }) => line),
      [3],
    );
  });
  it('checks turbo run through pnpm, pnpm exec and yarn', () => {
    const findings = workspaceFindings(
      'pnpm turbo lint',
      'pnpm exec turbo build',
      'yarn turbo test',
    );
    assert.deepEqual(
      withRule(findings, 'missing-task').map(({ line }) => line),
      [2, 4],
    );
  });

  it("doesn't crash on a trailing --filter with no value", () => {
    const findings = workspaceFindings('turbo build --filter');
    assert.deepEqual(withRule(findings, 'missing-task'), []);
  });
});

describe('script lookup', () => {
  it("doesn't treat inherited names or a non-object scripts field as scripts", () => {
    const inherited = findingsFor({
      'README.md': shell('npm run toString'),
      'package.json': { name: 'tool', scripts: { build: 'tsc' } },
    });
    const notAnObject = findingsFor({
      'README.md': shell('npm run build'),
      'package.json': { name: 'tool', scripts: 'tsc' },
    });
    assert.equal(withRule(inherited, 'missing-script').length, 1);
    assert.equal(withRule(notAnObject, 'missing-script').length, 1);
  });
});
