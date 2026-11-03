import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

const LICENSE_SECTION = readme('# Tool', '', '## License', '', 'Apache License 2.0');

describe('checkLicense', () => {
  it('notes a License section with no license file', () => {
    const findings = findingsFor({ 'README.md': LICENSE_SECTION });
    assert.deepEqual(
      withRule(findings, 'missing-license-file').map(({ line, level }) => [line, level]),
      [[3, 'note']],
    );
  });

  it('finds LICENSE, LICENCE.md or COPYING files', () => {
    for (const name of ['LICENSE', 'LICENCE.md', 'COPYING', 'license-mit.txt']) {
      const findings = findingsFor({ 'README.md': LICENSE_SECTION, [name]: '' });
      assert.deepEqual(withRule(findings, 'missing-license-file'), [], name);
    }
  });

  it('reports a license that differs from package.json', () => {
    const findings = findingsFor({
      'README.md': LICENSE_SECTION,
      'package.json': { name: 'tool', license: 'MIT' },
      LICENSE: '',
    });
    assert.deepEqual(withRule(findings, 'license-mismatch'), [
      {
        line: 5,
        level: 'error',
        rule: 'license-mismatch',
        message: 'README says Apache License but package.json says MIT',
      },
    ]);
  });

  it('accepts different spellings of the same license', () => {
    const findings = findingsFor({
      'README.md': LICENSE_SECTION,
      'package.json': { name: 'tool', license: 'Apache-2.0' },
      LICENSE: '',
    });
    assert.deepEqual(withRule(findings, 'license-mismatch'), []);
  });

  it('does nothing without a License heading', () => {
    const findings = findingsFor({ 'README.md': readme('# Tool', '', 'MIT licensed.') });
    assert.deepEqual(withRule(findings, 'missing-license-file'), []);
  });
});
