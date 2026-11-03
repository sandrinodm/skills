import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';
describe('StatusBadge', () => {
  it('marks a healthy service as ok', () => { render(<StatusBadge service={{ name: 'api', uptimeSeconds: 93784, errorRate: 0.002 }} />); expect(screen.getByText('api: 1d 2h').dataset.tone).toBe('ok'); });
  it('marks a service with many errors as degraded', () => { render(<StatusBadge service={{ name: 'worker', uptimeSeconds: 412, errorRate: 0.07 }} />); expect(screen.getByText('worker: 6m').dataset.tone).toBe('degraded'); });
  it('marks a service with no uptime as down', () => { render(<StatusBadge service={{ name: 'billing', uptimeSeconds: 0, errorRate: 0 }} />); expect(screen.getByText('billing: down').dataset.tone).toBe('down'); });
});
