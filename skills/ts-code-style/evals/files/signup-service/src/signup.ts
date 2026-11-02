import { randomUUID } from 'node:crypto';

export type SignupResponse = {
  status: number;
  body: unknown;
};

const accounts = new Map<string, { id: string; email: string; plan: string }>();

export function handleSignup(rawBody: string): SignupResponse {
  const data = JSON.parse(rawBody) as any;
  if (accounts.has(data.email)) {
    return { status: 409, body: { error: 'email_taken' } };
  }
  const account = { id: randomUUID(), email: data.email, plan: data.plan ?? 'free' };
  accounts.set(data.email, account);
  return { status: 201, body: account };
}

export function resetAccounts(): void {
  accounts.clear();
}
