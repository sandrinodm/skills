import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { syncAll } from './sync.ts';
import type { Deps, FeedItem } from './sync.ts';

const items: FeedItem[] = [
  { id: '1', title: 'First' },
  { id: '2', title: 'Second' },
];

function fakeDeps(feeds: Record<string, readonly FeedItem[]>): Deps & { saved: string[] } {
  const saved: string[] = [];

  return {
    saved,
    fetchFeed: async (url) => feeds[url],
    save: async (url) => {
      saved.push(url);
    },
  };
}

describe('syncAll', () => {
  it('saves every feed and reports how many items each had', async () => {
    const deps = fakeDeps({ 'https://a.test/feed': items, 'https://b.test/feed': [] });

    assert.deepEqual(await syncAll(deps, ['https://a.test/feed', 'https://b.test/feed']), [2, 0]);
    assert.deepEqual(deps.saved, ['https://a.test/feed', 'https://b.test/feed']);
  });

  it('fails when a feed is unavailable and saves nothing for it', async () => {
    const deps = fakeDeps({});

    await assert.rejects(syncAll(deps, ['https://missing.test/feed']));
    assert.deepEqual(deps.saved, []);
  });
});
