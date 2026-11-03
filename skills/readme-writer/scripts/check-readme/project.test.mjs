import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { hasLocalBinary, loadProject, readTextFile } from './project.mjs';
import { makeRepo, removeRepos } from './testing/repo.mjs';

after(removeRepos);

describe('loadProject', () => {
  it('reads the package, workspace, lockfile, turbo tasks and make and just targets', () => {
    const root = makeRepo({
      'package.json': { name: 'acme', workspaces: { packages: ['apps/*', '!apps/legacy'] } },
      'yarn.lock': '',
      'turbo.json': { pipeline: { build: {}, 'web#lint': {} } },
      Makefile: 'all: build\nbuild:\n\techo\n',
      justfile: '@deploy target:\n  echo\n',
      'apps/web/package.json': { name: 'web' },
      'apps/web/README.md': '',
      'apps/notes/': '',
    });
    const project = loadProject(path.join(root, 'apps/web/README.md'));
    const webDir = path.join(root, 'apps/web');
    assert.equal(project.dir, webDir);
    assert.equal(project.packageDir, webDir);
    assert.equal(project.manifest.name, 'web');
    assert.equal(project.workspaceRoot, root);
    assert.equal(project.repoRoot, root);
    assert.equal(project.rootManifest.name, 'acme');
    assert.deepEqual(
      project.workspaces.map(({ name, dir }) => [name, dir]),
      [
        ['web', webDir],
        ['acme', root],
      ],
    );
    assert.deepEqual([project.lockManager, project.lockFile], ['yarn', 'yarn.lock']);
    assert.deepEqual([...project.turboTasks], ['build', 'lint']);
    assert.deepEqual([...project.makeTargets], ['all', 'build']);
    assert.deepEqual([...project.justRecipes], ['deploy']);
  });

  it('uses the workspace root as the repo root when there is no .git folder', () => {
    const root = makeRepo({
      'package.json': { name: 'acme', workspaces: ['packages/*'] },
      'packages/ui/README.md': '',
    });
    fs.rmSync(path.join(root, '.git'), { recursive: true });
    const project = loadProject(path.join(root, 'packages/ui/README.md'));
    assert.equal(project.repoRoot, root);
    assert.equal(project.packageDir, root);
    assert.deepEqual(project.workspaces, [
      { name: 'acme', dir: root, manifest: project.rootManifest },
    ]);
    assert.equal(project.makeTargets, null);
  });
});

describe('workspace and recipe parsing', () => {
  it('reads pnpm workspace entries with trailing comments and just recipes with defaults', () => {
    const root = makeRepo({
      'package.json': { name: 'acme', private: true },
      'pnpm-workspace.yaml': "packages:\n  - 'apps/*' # the apps\n",
      justfile: 'deploy env="prod":\n  echo {{env}}\nversion := "1"\n',
      'apps/web/package.json': { name: 'web' },
      'README.md': '',
    });
    const project = loadProject(path.join(root, 'README.md'));
    assert.deepEqual(
      project.workspaces.map(({ name }) => name),
      ['web', 'acme'],
    );
    assert.deepEqual([...project.justRecipes], ['deploy']);
  });
});

describe('readTextFile', () => {
  it('returns null for a missing file or a directory', () => {
    const root = makeRepo({ 'a.txt': 'hello', 'dir/': '' });
    assert.equal(readTextFile(path.join(root, 'a.txt')), 'hello');
    assert.equal(readTextFile(path.join(root, 'dir')), null);
    assert.equal(readTextFile(path.join(root, 'missing.txt')), null);
  });
});

describe('hasLocalBinary', () => {
  it('looks in node_modules/.bin of the package and the workspace root', () => {
    const root = makeRepo({
      'package.json': { name: 'acme', workspaces: ['apps/*'] },
      'node_modules/.bin/turbo': '',
      'apps/web/package.json': { name: 'web' },
      'apps/web/README.md': '',
    });
    const project = loadProject(path.join(root, 'apps/web/README.md'));
    assert.equal(hasLocalBinary(project, 'turbo'), true);
    assert.equal(hasLocalBinary(project, 'vite'), false);
  });
});
