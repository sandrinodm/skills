import { formatUptime } from './formatUptime';
describe('formatUptime', () => {
  it('shows days and hours for long uptimes', () => { expect(formatUptime(93784)).toBe('1d 2h'); });
  it('shows hours and minutes under a day', () => { expect(formatUptime(3720)).toBe('1h 2m'); });
  it('shows minutes under an hour', () => { expect(formatUptime(412)).toBe('6m'); });
  it('shows seconds under a minute', () => { expect(formatUptime(42)).toBe('42s'); });
  it('shows down for zero', () => { expect(formatUptime(0)).toBe('down'); });
});
