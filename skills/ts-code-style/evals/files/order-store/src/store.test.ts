import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deleteOrder, listOrders, loadOrder, OrderNotFound } from './store.ts';
import type { Database, OrderRow } from './store.ts';

const row: OrderRow = { id: 'o1', customer_id: 'c1', total_cents: 1250, deleted_at: null };
const token = `x.${Buffer.from('{"sub":"u1"}').toString('base64url')}.y`;

function fakeDatabase(rows: OrderRow[], failures = 0): Database & { executed: unknown[][] } {
  let remainingFailures = failures;
  const executed: unknown[][] = [];

  return {
    executed,
    async query() {
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        throw new Error('database unavailable');
      }

      return rows;
    },
    async execute(_sql, params) {
      executed.push([...params]);
    },
  };
}

describe('store', () => {
  it('loads an order and keeps soft-deleted ones readable', async () => {
    const order = await loadOrder(fakeDatabase([{ ...row, deleted_at: '2026-10-01T00:00:00.000Z' }]), 'o1');

    assert.equal(order.customerId, 'c1');
    assert.ok(order.deletedAt instanceof Date);
  });

  it('retries a failing database up to three times', async () => {
    const order = await loadOrder(fakeDatabase([row], 2), 'o1');

    assert.equal(order.id, 'o1');
    await assert.rejects(loadOrder(fakeDatabase([row], 3), 'o1'));
  });

  it('fails with OrderNotFound for unknown orders', async () => {
    await assert.rejects(loadOrder(fakeDatabase([]), 'missing'), OrderNotFound);
  });

  it('lists orders for a customer', async () => {
    assert.equal((await listOrders(fakeDatabase([row]), 'c1')).length, 1);
  });

  it('soft-deletes orders', async () => {
    const db = fakeDatabase([row]);
    await deleteOrder(db, 'o1', token);

    assert.equal(db.executed[0]?.[1], 'o1');
  });
});
