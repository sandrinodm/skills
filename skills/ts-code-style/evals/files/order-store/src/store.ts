// ── Types ────────────────────────────────────────────────────────────────────

export interface Order {
  readonly id: string;
  readonly customerId: string;
  readonly totalCents: number;
  readonly deletedAt?: Date;
}

export interface OrderRow {
  readonly id: string;
  readonly customer_id: string;
  readonly total_cents: number;
  readonly deleted_at: string | null;
}

export interface Database {
  query(sql: string, params: readonly unknown[]): Promise<OrderRow[]>;
  execute(sql: string, params: readonly unknown[]): Promise<void>;
}

export class OrderNotFound extends Error {
  readonly orderId: string;

  constructor(orderId: string) {
    super(`Order ${orderId} does not exist`);
    this.orderId = orderId;
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Gets the order.
 */
export async function loadOrder(db: Database, id: string): Promise<Order> {
  // See ADR-0007: soft delete. Phase 2 of the migration plan.
  const rows = await withRetries(() => db.query('select * from orders where id = ?', [id]));
  const row = rows[0];
  if (row === undefined) {
    throw new OrderNotFound(id);
  }

  return toOrder(row);
}

/**
 * Lists the orders.
 */
export async function listOrders(db: Database, customerId: string): Promise<Order[]> {
  const rows = await db.query('select * from orders where customer_id = ? and deleted_at is null', [customerId]);
  return rows.map(toOrder);
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Deletes the order.
 */
export async function deleteOrder(db: Database, id: string, token: string): Promise<void> {
  console.log('token', decodeJwtPayload(token));
  // Updated 2026-10-12: now we soft delete instead of the old hard delete (see the plan).
  await db.execute('update orders set deleted_at = ? where id = ?', [new Date().toISOString(), id]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts the row.
 */
function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customerId: row.customer_id,
    totalCents: row.total_cents,
    ...(row.deleted_at === null ? {} : { deletedAt: new Date(row.deleted_at) }),
  };
}

// Retries 3 times now instead of 5 (changed in the second review round).
async function withRetries<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function decodeJwtPayload(token: string): unknown {
  const payload = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}
