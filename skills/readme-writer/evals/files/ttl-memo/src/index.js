import QuickLRU from 'quick-lru'

const DEFAULT_TTL_MS = 60_000
const DEFAULT_MAX_SIZE = 1000

/**
 * Wraps an async function so repeated calls with the same arguments reuse the result until it
 * expires. Concurrent calls with the same key share one in-flight promise. A rejected promise is
 * never cached: the next call runs the function again.
 *
 * @param {(...args: any[]) => Promise<any>} fn
 * @param {{ ttl?: number, maxSize?: number, key?: (...args: any[]) => string }} [options]
 *   ttl: milliseconds a result stays fresh (default 60000). maxSize: entries kept before the
 *   least recently used is evicted (default 1000). key: builds the cache key from the arguments
 *   (default JSON.stringify of the argument list).
 */
export function memo(fn, options = {}) {
  const ttl = options.ttl ?? DEFAULT_TTL_MS
  const key = options.key ?? ((...args) => JSON.stringify(args))

  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new RangeError(`ttl must be a positive number of milliseconds, got ${ttl}`)
  }

  const cache = new QuickLRU({ maxSize: options.maxSize ?? DEFAULT_MAX_SIZE, maxAge: ttl })

  const memoized = (...args) => {
    const cacheKey = key(...args)
    const cached = cache.get(cacheKey)

    if (cached) {
      return cached
    }

    const pending = Promise.resolve(fn(...args)).catch((error) => {
      cache.delete(cacheKey)
      throw error
    })

    cache.set(cacheKey, pending)

    return pending
  }

  /** Forgets every cached result. */
  memoized.clear = () => cache.clear()

  /** Forgets the result for one set of arguments. Returns true if there was one. */
  memoized.delete = (...args) => cache.delete(key(...args))

  return memoized
}
