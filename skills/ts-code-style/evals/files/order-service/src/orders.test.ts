import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OrderError, parseOrder, receipt, submit, total } from './orders.ts';

const body = {
  customer: 'acme_corp',
  items: [
    { sku: 'WIDGET', quantity: 2, unitCents: 1250 },
    { sku: 'GADGET', quantity: 1, unitCents: 999 },
  ],
};

function rejects(input: unknown, status: number, code: string, message: string) {
  assert.throws(
    () => parseOrder(input),
    (error: unknown) =>
      error instanceof OrderError &&
      error.status === status &&
      error.code === code &&
      error.message === message,
  );
}

describe('parseOrder', () => {
  it('accepts a minimal order and omits absent optional fields', () => {
    const order = parseOrder(body);
    assert.match(order.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(Object.keys(order), ['id', 'customer', 'items']);
  });

  it('keeps optional fields only when valid', () => {
    const order = parseOrder({
      ...body,
      express: true,
      coupon: 'FLAT5',
      giftNote: 'Happy birthday',
      currency: 'USD',
    });
    assert.equal(order.express, true);
    assert.equal(order.coupon, 'FLAT5');
    assert.equal(order.giftNote, 'Happy birthday');
    assert.equal(order.currency, 'USD');
    assert.equal(parseOrder({ ...body, giftNote: 'x'.repeat(281) }).giftNote, undefined);
    assert.equal(parseOrder({ ...body, currency: 'EUR' }).currency, undefined);
  });

  it('rejects invalid input with exact errors', () => {
    const invalidOrder = 'Order must be a JSON object with a customer and between 1 and 50 items.';
    rejects(null, 400, 'invalid_order', invalidOrder);
    rejects({ ...body, customer: 'x' }, 400, 'invalid_order', invalidOrder);
    rejects({ ...body, items: [] }, 400, 'invalid_order', invalidOrder);
    rejects({ ...body, items: Array(51).fill(body.items[0]) }, 400, 'invalid_order', invalidOrder);
    rejects({ ...body, priority: 1 }, 400, 'unsupported_field', 'Unsupported field priority.');
    rejects(
      { ...body, items: [{ sku: 'A', quantity: 1000, unitCents: 1 }] },
      400,
      'invalid_item',
      'Each item needs a sku, a quantity from 1 to 999 and a nonnegative unitCents.',
    );
    rejects({ ...body, currency: 'GBP' }, 400, 'invalid_currency', 'Currency must be EUR or USD.');
  });
});

describe('total', () => {
  const order = { ...parseOrder(body), id: 'fixed' };
  const friday = new Date('2026-10-30T12:00:00Z');
  const monday = new Date('2026-11-02T12:00:00Z');

  it('applies coupons, shipping and tax', () => {
    assert.deepEqual(total(order), {
      subtotal: 3499,
      discount: 0,
      shipping: 495,
      tax: 839,
      total: 4833,
      currency: 'EUR',
    });
    assert.equal(total({ ...order, coupon: 'WELCOME10' }).discount, 350);
    assert.equal(total({ ...order, coupon: 'FLAT5' }).discount, 500);
    assert.equal(total({ ...order, coupon: 'VIP-1' }, friday).discount, 700);
    assert.equal(total({ ...order, coupon: 'VIP-1' }, monday).discount, 0);
    assert.equal(total({ ...order, express: true }).shipping, 1500);
    assert.equal(total(order, undefined, undefined, 3000).shipping, 0);
    assert.equal(total(order, undefined, 0).tax, 0);
    assert.equal(total({ ...order, currency: 'USD' }).tax, 290);
  });
});

describe('receipt', () => {
  it('renders the exact receipt text', () => {
    const order = { ...parseOrder({ ...body, coupon: 'FLAT5', giftNote: 'Enjoy' }), id: 'ord-1' };
    assert.equal(
      receipt(order),
      [
        'Order ord-1 for acme_corp',
        '2 x WIDGET @ €12.50',
        '1 x GADGET @ €9.99',
        'Subtotal: €34.99',
        'Discount: -€5.00',
        'Shipping: €4.95',
        'Tax: €7.34',
        'Total: €42.28',
        'Gift note: Enjoy',
        '',
      ].join('\n'),
    );
    const usd = { ...parseOrder({ ...body, currency: 'USD', express: true }), id: 'ord-2' };
    assert.match(receipt(usd), /Shipping: \$15\.00\nTax: \$3\.62\nTotal: \$53\.61\n$/);
  });
});

describe('submit', () => {
  const order = { ...parseOrder(body), id: 'ord-3' };

  it('retries standard orders on server errors', async () => {
    const statuses = [503, 200];
    const result = await submit(order, async () => {
      const status = statuses.shift()!;
      return { ok: status < 400, status };
    });
    assert.deepEqual(result, { id: 'ord-3', accepted: true, status: 200 });
  });

  it('does not retry client errors or express orders', async () => {
    let calls = 0;
    const reject = async () => {
      calls++;
      return { ok: false, status: 422 };
    };
    await assert.rejects(submit(order, reject), {
      code: 'carrier_rejected',
      message: 'The carrier rejected the order after retries. Try again later.',
    });
    await assert.rejects(submit({ ...order, express: true }, reject), {
      code: 'carrier_rejected',
      message: 'The express carrier rejected the order. Try standard shipping.',
    });
    assert.equal(calls, 2);
  });
});
