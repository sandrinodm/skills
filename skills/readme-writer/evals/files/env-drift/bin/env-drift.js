#!/usr/bin/env node

import fs from 'node:fs'
import { parseArgs } from 'node:util'

const EXIT_OK = 0
const EXIT_DRIFT = 1
const EXIT_USAGE = 2

const HELP = [
  'Usage: env-drift [options]',
  '',
  'Compares the keys in a .env file with the keys in .env.example.',
  '',
  'Options:',
  '  -e, --env <path>       file to check (default: .env)',
  '  -x, --example <path>   file listing the expected keys (default: .env.example)',
  '      --strict           also fail when .env has keys that .env.example lacks',
  '      --json             print the report as JSON',
  '  -h, --help             show this help',
  '  -v, --version          print the version',
  '',
  'Exit codes: 0 no drift, 1 drift found, 2 a file could not be read or bad arguments.',
].join('\n')

main()

function main() {
  let values

  try {
    ;({ values } = parseArgs({
      options: {
        env: { type: 'string', short: 'e', default: '.env' },
        example: { type: 'string', short: 'x', default: '.env.example' },
        strict: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    }))
  } catch (error) {
    console.error(`env-drift: ${error.message}\n\n${HELP}`)
    process.exit(EXIT_USAGE)
  }

  if (values.help) {
    console.log(HELP)
    process.exit(EXIT_OK)
  }

  if (values.version) {
    const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    console.log(manifest.version)
    process.exit(EXIT_OK)
  }

  const env = readEnv(values.env)
  const example = readEnv(values.example)
  const report = compare(env, example)
  const failed = report.missing.length > 0 || (values.strict && report.extra.length > 0)

  if (values.json) {
    console.log(JSON.stringify({ ...report, ok: !failed }, null, 2))
  } else {
    printReport(report, values)
  }

  process.exit(failed ? EXIT_DRIFT : EXIT_OK)
}

/** Reads KEY=value lines, ignoring comments, blank lines and an optional `export ` prefix. */
function readEnv(file) {
  let text

  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    console.error(`env-drift: cannot read ${file}`)
    process.exit(EXIT_USAGE)
  }

  const entries = new Map()

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)

    if (match) {
      entries.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2').trim())
    }
  }

  return entries
}

function compare(env, example) {
  return {
    missing: [...example.keys()].filter((key) => !env.has(key)),
    extra: [...env.keys()].filter((key) => !example.has(key)),
    empty: [...env.entries()].filter(([key, value]) => example.has(key) && value === '').map(([key]) => key),
  }
}

function printReport(report, values) {
  const rows = [
    ...report.missing.map((key) => ['missing', key, `in ${values.example}, not in ${values.env}`]),
    ...report.extra.map((key) => ['extra', key, `in ${values.env}, not in ${values.example}`]),
    ...report.empty.map((key) => ['empty', key, `set but empty in ${values.env}`]),
  ]

  if (rows.length === 0) {
    console.log(`${values.env} matches ${values.example}`)
    return
  }

  const width = Math.max(...rows.map(([, key]) => key.length))

  for (const [kind, key, detail] of rows) {
    console.log(`${kind.padEnd(8)} ${key.padEnd(width)}  ${detail}`)
  }
}
