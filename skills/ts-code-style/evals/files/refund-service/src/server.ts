import { Effect } from 'effect';

import { recordRefund, type RefundStore } from './refunds.ts';

export const handleRefundRequest = (store: RefundStore, body: string) =>
  Effect.tryPromise(() => recordRefund(store, body)).pipe(
    Effect.as({ status: 202 }),
    Effect.catch(() => Effect.succeed({ status: 400 })),
  );
