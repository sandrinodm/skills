import { StatusBadge } from './components/StatusBadge';
import type { Service } from './lib/serviceTypes';
const SERVICES: Service[] = [{ name: 'api', uptimeSeconds: 93784, errorRate: 0.002 }, { name: 'worker', uptimeSeconds: 412, errorRate: 0.07 }, { name: 'billing', uptimeSeconds: 0, errorRate: 0 }];
export function App() {
  return <main><h1>Status</h1><ul>{SERVICES.map((s) => <li key={s.name}><StatusBadge service={s} /></li>)}</ul></main>;
}
