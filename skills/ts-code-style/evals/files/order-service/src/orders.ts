import { randomUUID } from 'node:crypto';

export class OrderError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

export type Item = { sku: string; quantity: number; unitCents: number };
export type Order = { id: string; customer: string; items: Item[]; express?: boolean; coupon?: string; giftNote?: string; currency?: 'EUR' | 'USD' };

/**
 * Strict order subset: unknown knobs not silently ignored.
 */
export function parseOrder(body: unknown): Order {
  if (!body || typeof body !== 'object') throw new OrderError(400, 'invalid_order', 'Order must be a JSON object with a customer and between 1 and 50 items.');
  const b = body as Record<string, unknown>;
  for (const k of Object.keys(b)) if (!['customer', 'items', 'express', 'coupon', 'giftNote', 'currency'].includes(k)) throw new OrderError(400, 'unsupported_field', `Unsupported field ${k}.`);
  if (typeof b.customer !== 'string' || !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(b.customer)) throw new OrderError(400, 'invalid_order', 'Order must be a JSON object with a customer and between 1 and 50 items.');
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) throw new OrderError(400, 'invalid_order', 'Order must be a JSON object with a customer and between 1 and 50 items.');
  const items = b.items.map((i: any) => {
    if (!i || typeof i.sku !== 'string' || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 999 || !Number.isInteger(i.unitCents) || i.unitCents < 0 || i.unitCents > 10000000) throw new OrderError(400, 'invalid_item', 'Each item needs a sku, a quantity from 1 to 999 and a nonnegative unitCents.');
    return { sku: i.sku, quantity: i.quantity, unitCents: i.unitCents };
  });
  return { id: randomUUID(), customer: b.customer, items, ...(b.express === true ? { express: true } : {}), ...(typeof b.coupon === 'string' ? { coupon: b.coupon } : {}), ...(typeof b.giftNote === 'string' && b.giftNote.length <= 280 ? { giftNote: b.giftNote } : {}), ...(b.currency === 'USD' ? { currency: 'USD' as const } : b.currency === 'EUR' || b.currency === undefined ? {} : (() => { throw new OrderError(400, 'invalid_currency', 'Currency must be EUR or USD.'); })()) };
}

// compute total
export function total(order: Order, now: Date | undefined = undefined, taxRate: number | undefined = undefined, freeShippingOver: number | undefined = undefined) {
  const subtotal = order.items.reduce((s, i) => s + i.quantity * i.unitCents, 0);
  const discount = order.coupon === 'WELCOME10' ? Math.round(subtotal * 0.1) : order.coupon === 'FLAT5' ? Math.min(500, subtotal) : order.coupon && order.coupon.startsWith('VIP') && (now ?? new Date()).getUTCDay() === 5 ? Math.round(subtotal * 0.2) : 0;
  const shipping = subtotal - discount >= (freeShippingOver ?? 5000) ? 0 : order.express ? 1500 : 495;
  const tax = Math.round((subtotal - discount + shipping) * (taxRate ?? (order.currency === 'USD' ? 0.0725 : 0.21)));
  return { subtotal, discount, shipping, tax, total: subtotal - discount + shipping + tax, currency: order.currency ?? 'EUR' };
}

export function receipt(order: Order, t = total(order)) {
  const fmt = (c: number) => `${t.currency === 'USD' ? '$' : '€'}${(c / 100).toFixed(2)}`;
  return `Order ${order.id} for ${order.customer}\n${order.items.map((i) => `${i.quantity} x ${i.sku} @ ${fmt(i.unitCents)}`).join('\n')}\nSubtotal: ${fmt(t.subtotal)}\n${t.discount ? `Discount: -${fmt(t.discount)}\n` : ''}Shipping: ${t.shipping === 0 ? 'free' : fmt(t.shipping)}\nTax: ${fmt(t.tax)}\nTotal: ${fmt(t.total)}${order.giftNote ? `\nGift note: ${order.giftNote}` : ''}\n`;
}

export async function submit(order: Order, send: (o: Order) => Promise<{ ok: boolean; status: number }>, retries = 3) {
  return (order.express ? send(order).then((r) => (r.ok ? r : Promise.reject(new OrderError(502, 'carrier_rejected', 'The express carrier rejected the order. Try standard shipping.')))) : (async () => { for (let a = 0; ; a++) { const r = await send(order); if (r.ok) return r; if (a >= retries - 1 || r.status < 500) throw new OrderError(502, 'carrier_rejected', 'The carrier rejected the order after retries. Try again later.'); await new Promise((res) => setTimeout(res, 2 ** a * 100)); } })()).then((r) => ({ id: order.id, accepted: true, status: r.status }));
}
