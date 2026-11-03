// format uptime
export function formatUptime(s: number): string {
  if (s <= 0) return 'down';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : `${s}s`;
}
