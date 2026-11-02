import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { BundleError, countLines, readBundle, resolveSecret } from './bundle.ts';

async function appWith(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'bundle-'));
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(path.join(root, name), contents);
  }

  return root;
}

describe('readBundle', () => {
  it('reads compose files and assets once each', async () => {
    const root = await appWith({ 'compose.yaml': 'services: {}\n', 'Caddyfile': ':80\n' });
    const bundle = await readBundle({ root, composeFiles: ['compose.yaml'], assets: ['Caddyfile', 'compose.yaml'] });

    assert.deepEqual([...bundle.files.keys()], ['compose.yaml', 'Caddyfile']);
    assert.equal(bundle.totalBytes, 17);
  });

  it('rejects apps without compose files', async () => {
    await assert.rejects(readBundle({ root: '/tmp', composeFiles: [] }), BundleError);
  });

  it('rejects relative app roots', async () => {
    await assert.rejects(readBundle({ root: 'apps/web', composeFiles: ['compose.yaml'] }), BundleError);
  });

  it('rejects paths that leave the app root', async () => {
    const root = await appWith({ 'compose.yaml': '' });

    await assert.rejects(readBundle({ root, composeFiles: ['../secrets.env'] }), /stay inside the app root/);
  });
});

describe('resolveSecret', () => {
  it('trims single-line secrets', () => {
    assert.equal(resolveSecret({ TOKEN: ' abc ' }, 'TOKEN'), 'abc');
  });

  it('rejects missing and multi-line secrets', () => {
    assert.throws(() => resolveSecret({}, 'TOKEN'), BundleError);
    assert.throws(() => resolveSecret({ TOKEN: 'a\nb' }, 'TOKEN'), BundleError);
  });
});

describe('countLines', () => {
  it('counts newline-terminated lines', () => {
    assert.equal(countLines('a\nb\n'), 2);
  });
});
