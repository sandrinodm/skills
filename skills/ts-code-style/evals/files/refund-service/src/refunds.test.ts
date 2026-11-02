import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeRefund, parseRefundRequest } from './refunds.ts';

test('parses a valid refund request', () => {
  const request = parseRefundRequest(
    JSON.stringify({ orderId: 'ord_1', amountCents: 1250, currency: 'EUR' }),
  );
  assert.equal(request.orderId, 'ord_1');
  assert.equal(request.amountCents, 1250);
  assert.equal(request.currency, 'EUR');
});

test('describes a pending refund', () => {
  assert.equal(describeRefund({ status: 'pending' }), 'Pending review');
});
