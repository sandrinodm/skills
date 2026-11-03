import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { findingsFor, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

const WEB_README = readme(
  'Open http://localhost:3000 in a browser.',
  '```sh',
  'curl 127.0.0.1:8787/health',
  'psql -h 0.0.0.0:5432',
  '```',
);

// A web app whose dev script pins port 3001, next to an API worker on 8787.
function webFindings(files = {}) {
  return findingsFor(
    {
      'package.json': { name: 'acme', private: true, workspaces: ['apps/*'] },
      'apps/web/README.md': WEB_README,
      'apps/web/package.json': { name: 'web', scripts: { dev: 'next dev --port 3001' } },
      'apps/api/package.json': { name: 'api', scripts: { dev: 'wrangler dev --port=8787' } },
      ...files,
    },
    { readmePath: 'apps/web/README.md' },
  );
}

describe('checkPorts', () => {
  it('reports localhost ports that differ from the dev script', () => {
    const findings = withRule(webFindings(), 'wrong-port');
    assert.deepEqual(
      findings.map(({ line, message }) => [line, message]),
      [
        [1, 'README says port 3000 but the dev script runs on 3001 ("next dev --port 3001")'],
        [4, 'README says port 5432 but the dev script runs on 3001 ("next dev --port 3001")'],
      ],
    );
  });

  it('allows ports from .env examples and docker compose', () => {
    const findings = webFindings({
      '.env.example': 'DATABASE_PORT=5432\n',
      'apps/web/compose.yaml': 'ports:\n  - "3000:3000"\n',
    });
    assert.deepEqual(withRule(findings, 'wrong-port'), []);
  });

  it('does nothing when the dev script pins no port', () => {
    const findings = findingsFor({
      'README.md': 'Open http://localhost:3000.',
      'package.json': { name: 'tool', scripts: { dev: 'vite' } },
    });
    assert.deepEqual(withRule(findings, 'wrong-port'), []);
  });
});
