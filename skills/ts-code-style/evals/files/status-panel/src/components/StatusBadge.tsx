import { formatUptime } from '../lib/formatUptime';
import type { Service } from '../lib/serviceTypes';
export function StatusBadge({ service }: { service: Service }) {
  const tone = service.uptimeSeconds <= 0 ? 'down' : service.errorRate > 0.05 ? 'degraded' : service.errorRate > 0.01 ? 'warning' : 'ok';
  return <span data-tone={tone} title={`${(service.errorRate * 100).toFixed(1)}% errors`}>{service.name}: {formatUptime(service.uptimeSeconds)}</span>;
}
