import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./rename-kebab.mjs', import.meta.url));
const USAGE = 'Usage: node rename-kebab.mjs <repo-root> [--write] [--skip=<path-prefix>]...\n';
const APP_SHELL = 'export const AppShell = 1;\n';

/**
 * The fixture commit sets its own identity and skips signing, so it works without the user's git
 * configuration.
 */
const TEST_COMMITTER = [
  '-c',
  'user.name=rename-kebab test',
  '-c',
  'user.email=test@example.com',
  '-c',
  'commit.gpgsign=false',
];

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-kebab-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

describe('rename-kebab', () => {
  it('prints the plan without changing anything by default', () => {
    const main = "import { AppShell } from './AppShell';\n";
    const repo = createRepo({ 'src/AppShell.tsx': APP_SHELL, 'src/main.ts': main });
    const result = run(repo);
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout,
      'src/AppShell.tsx -> src/app-shell.tsx\n1 files, 1 import specifiers (dry run)\n',
    );
    assert.deepEqual(trackedFiles(repo), ['src/AppShell.tsx', 'src/main.ts']);
    assert.equal(read(repo, 'src/main.ts'), main);
  });

  it('kebab-cases PascalCase, camelCase and acronyms and keeps the suffixes', () => {
    const repo = createRepo({
      'src/DNSDashboard.tsx': '',
      'src/useAuth2.test.ts': '',
      'src/order_summary.ts': '',
      'src/already-kebab.ts': '',
    });
    assert.equal(
      run(repo).stdout,
      [
        'src/DNSDashboard.tsx -> src/dns-dashboard.tsx',
        'src/useAuth2.test.ts -> src/use-auth2.test.ts',
        '2 files, 0 import specifiers (dry run)',
        '',
      ].join('\n'),
    );
  });

  it('renames tracked files with git mv and rewrites the imports that point at them', () => {
    const repo = createRepo({
      'src/AppShell.tsx': APP_SHELL,
      'src/main.ts': "import { AppShell } from './AppShell';\n",
    });
    const result = run(repo, '--write');
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout,
      [
        'src/AppShell.tsx -> src/app-shell.tsx',
        '1 files, 1 import specifiers',
        'No mentions of the old names remain.',
        '',
      ].join('\n'),
    );
    assert.deepEqual(trackedFiles(repo), ['src/app-shell.tsx', 'src/main.ts']);
    assert.match(
      git(repo, 'status', '--porcelain'),
      /^R {2}src\/AppShell\.tsx -> src\/app-shell\.tsx$/m,
    );
    assert.equal(read(repo, 'src/main.ts'), "import { AppShell } from './app-shell';\n");
  });

  it('keeps the quotes and extension of each specifier and leaves folder imports alone', () => {
    const main = [
      "import { OrderSummary } from './OrderSummary.js';",
      'import { formatUptime } from "../lib/formatUptime";',
      "import { config } from './Config';",
      "const lazy = () => import('./OrderSummary.js');",
      '',
    ].join('\n');
    const repo = createRepo({
      'src/ui/OrderSummary.ts': '',
      'src/ui/main.ts': main,
      'src/ui/Config/index.ts': '',
      'src/lib/formatUptime.ts': '',
    });
    const result = run(repo, '--write');
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^2 files, 3 import specifiers$/m);
    assert.equal(
      read(repo, 'src/ui/main.ts'),
      [
        "import { OrderSummary } from './order-summary.js';",
        'import { formatUptime } from "../lib/format-uptime";',
        "import { config } from './Config';",
        "const lazy = () => import('./order-summary.js');",
        '',
      ].join('\n'),
    );
  });

  it('renames untracked files without adding them to git', () => {
    const repo = createRepo({ 'src/main.ts': '' }, { 'src/UserCard.tsx': '' });
    assert.equal(run(repo, '--write').status, 0);
    assert.ok(fs.existsSync(path.join(repo, 'src/user-card.tsx')));
    assert.deepEqual(trackedFiles(repo), ['src/main.ts']);
    assert.equal(git(repo, 'ls-files', '--others'), 'src/user-card.tsx\n');
  });

  it('skips the files whose names a framework, a generator or --skip owns', () => {
    const repo = createRepo({
      'src/routes/OrderPage.tsx': '',
      'src/routeTree.gen.ts': '',
      'src/Globals.d.ts': '',
      'src/__Root.tsx': '',
      'src/vendor/DatePicker.tsx': '',
    });
    const result = run(repo, '--skip=src/vendor/');
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout,
      [
        'skipped: src/Globals.d.ts',
        'skipped: src/routeTree.gen.ts',
        'skipped: src/routes/OrderPage.tsx',
        'skipped: src/vendor/DatePicker.tsx',
        '0 files, 0 import specifiers (dry run)',
        '',
      ].join('\n'),
    );
  });

  it('renames nothing and exits with 1 when a target already exists', () => {
    const repo = createRepo({ 'src/OrderList.ts': '', 'src/order-list.ts': '' });
    const result = run(repo, '--write');
    assert.equal(result.status, 1);
    assert.equal(result.stdout, 'src/OrderList.ts -> src/order-list.ts\n');
    assert.equal(
      result.stderr,
      [
        'conflict: src/OrderList.ts -> src/order-list.ts, but src/order-list.ts already exists',
        'Nothing renamed. Resolve the conflicts above, or --skip those files.',
        '',
      ].join('\n'),
    );
    assert.deepEqual(trackedFiles(repo), ['src/OrderList.ts', 'src/order-list.ts']);
  });

  it('renames nothing and exits with 1 when two files would get the same name', () => {
    const repo = createRepo({ 'src/FooBar.ts': '', 'src/Foo_Bar.ts': '' });
    const result = run(repo, '--write');
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /^conflict: src\/Foo_Bar\.ts and src\/FooBar\.ts would both become src\/foo-bar\.ts$/m,
    );
    assert.deepEqual(trackedFiles(repo), ['src/FooBar.ts', 'src/Foo_Bar.ts']);
  });

  it('lists the mentions of old names that it could not rewrite', () => {
    const repo = createRepo({
      'src/AppShell.tsx': APP_SHELL,
      'src/main.ts': "import { AppShell } from '#components/AppShell';\n",
      'README.md': 'The layout lives in `src/AppShell.tsx`.\n',
    });
    const result = run(repo, '--write');
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout,
      [
        'src/AppShell.tsx -> src/app-shell.tsx',
        '1 files, 0 import specifiers',
        'leftover: README.md:1: The layout lives in `src/AppShell.tsx`.',
        "leftover: src/main.ts:1: import { AppShell } from '#components/AppShell';",
        '2 leftover mentions to check.',
        '',
      ].join('\n'),
    );
  });

  it('prints the usage and exits with 2 without a repo root or with an unknown flag', () => {
    const repo = createRepo({});
    for (const args of [[], [repo, repo], [repo, '--force']]) {
      const result = run(...args);
      assert.equal(result.status, 2, args.join(' '));
      assert.equal(result.stderr, USAGE, args.join(' '));
      assert.equal(result.stdout, '', args.join(' '));
    }
  });
});

/**
 * Creates a git repository in the scratch folder. `tracked` files are committed, so a later
 * `git mv` shows up as a rename; `untracked` files are only written to disk. Both map a
 * repo-relative path to file contents.
 */
function createRepo(tracked, untracked = {}) {
  const repo = fs.mkdtempSync(path.join(scratch, 'repo-'));
  git(repo, 'init', '--quiet');
  writeFiles(repo, tracked);
  git(repo, 'add', '--all');
  git(repo, ...TEST_COMMITTER, 'commit', '--quiet', '--allow-empty', '--message', 'fixture');
  writeFiles(repo, untracked);
  return repo;
}

function writeFiles(root, files) {
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
}

function trackedFiles(repo) {
  return git(repo, 'ls-files').split('\n').filter(Boolean);
}

function read(repo, file) {
  return fs.readFileSync(path.join(repo, file), 'utf8');
}

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
}

function run(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}
