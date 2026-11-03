import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

const ENV_EXAMPLE = '# Database\nexport DATABASE_URL=postgres://\nAPI_KEY = \nlower=1\n';

describe('checkEnv', () => {
  it('notes variables the README never mentions', () => {
    const findings = findingsFor({
      'README.md': 'Set `DATABASE_URL` first.',
      '.env.example': ENV_EXAMPLE,
    });
    assert.deepEqual(withRule(findings, 'env-not-documented'), [
      {
        line: 1,
        level: 'note',
        rule: 'env-not-documented',
        message:
          '.env.example defines API_KEY but the README mentions neither the file ' +
          'nor those variables',
      },
    ]);
  });

  it('accepts a README that mentions the example file', () => {
    const findings = findingsFor({
      'README.md': 'Copy `.dev.vars.example` to `.dev.vars`.',
      '.dev.vars.example': ENV_EXAMPLE,
    });
    assert.deepEqual(withRule(findings, 'env-not-documented'), []);
  });

  it('accepts a README that mentions every variable', () => {
    const findings = findingsFor({
      'README.md': 'Set DATABASE_URL and API_KEY.',
      '.env.sample': ENV_EXAMPLE,
    });
    assert.deepEqual(withRule(findings, 'env-not-documented'), []);
  });
});
