import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { handleSignup, resetAccounts } from './signup.ts';

beforeEach(() => {
  resetAccounts();
});

test('creates an account', () => {
  const response = handleSignup(
    JSON.stringify({ email: 'ada@example.com', password: 'correct horse battery', plan: 'pro' }),
  );
  assert.equal(response.status, 201);
});

test('rejects a duplicate email', () => {
  const body = JSON.stringify({ email: 'ada@example.com', password: 'correct horse battery' });
  handleSignup(body);
  assert.equal(handleSignup(body).status, 409);
});
