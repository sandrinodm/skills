import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { memo } from './index.js'

describe('memo', () => {
  it('reuses the result for the same arguments', async () => {
    let calls = 0
    const double = memo(async (n) => {
      calls++
      return n * 2
    })

    assert.equal(await double(2), 4)
    assert.equal(await double(2), 4)
    assert.equal(calls, 1)
  })

  it('shares one in-flight promise between concurrent calls', async () => {
    let calls = 0
    const slow = memo(async () => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 20))
      return 'done'
    })

    await Promise.all([slow(), slow(), slow()])
    assert.equal(calls, 1)
  })

  it('does not cache rejections', async () => {
    let calls = 0
    const flaky = memo(async () => {
      calls++
      if (calls === 1) throw new Error('first call fails')
      return 'ok'
    })

    await assert.rejects(flaky(), /first call fails/)
    assert.equal(await flaky(), 'ok')
  })

  it('expires results after ttl', async () => {
    let calls = 0
    const now = memo(async () => ++calls, { ttl: 30 })

    await now()
    await new Promise((resolve) => setTimeout(resolve, 60))
    await now()
    assert.equal(calls, 2)
  })

  it('rejects a non-positive ttl', () => {
    assert.throws(() => memo(async () => 1, { ttl: 0 }), RangeError)
  })
})
