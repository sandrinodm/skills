export type MemoOptions<Args extends unknown[]> = {
  /** Milliseconds a result stays fresh. Default 60000. */
  ttl?: number
  /** Entries kept before the least recently used one is evicted. Default 1000. */
  maxSize?: number
  /** Builds the cache key from the arguments. Default: JSON.stringify of the argument list. */
  key?: (...args: Args) => string
}

export type Memoized<Args extends unknown[], Result> = ((...args: Args) => Promise<Result>) & {
  clear: () => void
  delete: (...args: Args) => boolean
}

export function memo<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options?: MemoOptions<Args>,
): Memoized<Args, Result>
