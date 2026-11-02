export type RefundState = {
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: Date;
  rejectionReason?: string;
};

export interface RefundStore {
  save(refund: any): Promise<void>;
}

export function parseRefundRequest(body: string): any {
  const data = JSON.parse(body) as any;
  return data;
}

export function describeRefund(state: RefundState): string {
  if (state.status === 'approved') {
    return `Approved on ${state.approvedAt!.toISOString().slice(0, 10)}`;
  }
  if (state.status === 'rejected') {
    return `Rejected: ${state.rejectionReason}`;
  }
  return 'Pending review';
}

export async function recordRefund(store: RefundStore, body: string): Promise<void> {
  await store.save(parseRefundRequest(body));
}
