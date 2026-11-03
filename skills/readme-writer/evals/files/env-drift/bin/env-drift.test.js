import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

const BIN = new URL('./env-drift.js', import.meta.url).pathname

function run(files, args = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-'))

  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text)
  }

  return spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8' })
}

describe('env-drift', () => {
  it('exits 0 when every expected key is present', () => {
    const result = run({ '.env': 'A=1\nB=2\n', '.env.example': 'A=\nB=\n' })
    assert.equal(result.status, 0)
    assert.match(result.stdout, /\.env matches \.env\.example/)
  })

  it('exits 1 and lists missing keys', () => {
    const result = run({ '.env': 'A=1\n', '.env.example': 'A=\nSTRIPE_SECRET_KEY=\n' })
    assert.equal(result.status, 1)
    assert.match(result.stdout, /missing\s+STRIPE_SECRET_KEY/)
  })

  it('reports extra keys but only fails on them with --strict', () => {
    const files = { '.env': 'A=1\nDEBUG=1\n', '.env.example': 'A=\n' }
    assert.equal(run(files).status, 0)
    assert.equal(run(files, ['--strict']).status, 1)
  })

  it('flags empty values', () => {
    const result = run({ '.env': 'AUTH_SECRET=\n', '.env.example': 'AUTH_SECRET=\n' })
    assert.match(result.stdout, /empty\s+AUTH_SECRET/)
  })

  it('prints JSON with --json', () => {
    const result = run({ '.env': 'A=1\n', '.env.example': 'A=\nB=\n' }, ['--json'])
    assert.deepEqual(JSON.parse(result.stdout), { missing: ['B'], extra: [], empty: [], ok: false })
  })

  it('exits 2 when a file is missing', () => {
    const result = run({ '.env.example': 'A=\n' })
    assert.equal(result.status, 2)
  })
})
