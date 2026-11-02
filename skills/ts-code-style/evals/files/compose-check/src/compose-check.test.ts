import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkConnector, TemplateError } from './compose-check.ts';
import type { ConnectorService } from './compose-check.ts';

const valid: ConnectorService = {
  image: 'cloudflare/cloudflared:2026.10.0',
  command: ['tunnel', 'run'],
  environment: { TUNNEL_TOKEN: 'abc123==' },
  read_only: true,
  cap_drop: ['ALL'],
  security_opt: ['no-new-privileges:true'],
};

describe('checkConnector', () => {
  it('returns the token of an isolated connector', () => {
    assert.equal(checkConnector(valid), 'abc123==');
  });

  const broken: Record<string, ConnectorService> = {
    'a writable filesystem': { ...valid, read_only: false },
    'privileged mode': { ...valid, privileged: true },
    'published ports': { ...valid, ports: ['8080:8080'] },
    'mounted volumes': { ...valid, volumes: ['/:/host'] },
    'a build context': { ...valid, build: '.' },
    'a custom network mode': { ...valid, network_mode: 'host' },
    'added capabilities': { ...valid, cap_add: ['NET_ADMIN'] },
    'kept capabilities': { ...valid, cap_drop: [] },
    'privilege escalation': { ...valid, security_opt: [] },
    'a missing token': { ...valid, environment: {} },
    'a multi-line token': { ...valid, environment: { TUNNEL_TOKEN: 'abc\n123' } },
  };

  for (const [problem, connector] of Object.entries(broken)) {
    it(`rejects ${problem}`, () => {
      assert.throws(() => checkConnector(connector), TemplateError);
    });
  }
});
