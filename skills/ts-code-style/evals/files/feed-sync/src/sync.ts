import { Effect } from 'effect';

export interface FeedItem {
  readonly id: string;
  readonly title: string;
}

export type Deps = {
  readonly fetchFeed: (url: string) => Promise<readonly FeedItem[] | undefined>;
  readonly save: (url: string, items: readonly FeedItem[]) => Promise<void>;
};

export function runEffect<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
  return Effect.runPromise(effect);
}

export const syncFeed = (deps: Deps, url: string) =>
  Effect.gen(function* () {
    const items = yield* Effect.tryPromise(() => deps.fetchFeed(url));
    if (items === undefined) {
      throw new Error('Feed unavailable');
    }
    console.log('fetched', items.length, 'items from', url);
    yield* Effect.tryPromise(() => deps.save(url, items));
    console.log('synced', url);
    return items.length;
  });

export function syncAll(deps: Deps, urls: readonly string[]): Promise<number[]> {
  return runEffect(Effect.all(urls.map((url) => syncFeed(deps, url))));
}
