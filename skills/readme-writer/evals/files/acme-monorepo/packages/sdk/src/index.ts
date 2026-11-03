/** An invoice as returned by the Acme Invoices API. Amounts are in the currency's minor unit. */
export type Invoice = {
  id: number
  number: string
  customerId: string
  amountCents: number
  currency: string
  status: 'open' | 'paid' | 'void'
  createdAt: string
}

export type ClientOptions = {
  /** API key from the Acme dashboard. Sent as a bearer token. */
  apiKey: string
  /** Defaults to https://api.acme-invoices.dev. */
  baseUrl?: string
  /** Replace the global fetch, e.g. in tests. */
  fetch?: typeof fetch
}

export type CreateInvoice = {
  customerId: string
  amountCents: number
  /** ISO 4217 code, lowercase (`eur`, `usd`). */
  currency: string
}

/** Thrown for any non-2xx response. `status` is the HTTP status code. */
export class AcmeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const DEFAULT_BASE_URL = 'https://api.acme-invoices.dev'

/** Creates a client for the Acme Invoices API. Uses the global `fetch`, so it needs Node 20+ or a browser. */
export function createClient(options: ClientOptions) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const fetchImpl = options.fetch ?? fetch

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
    })

    if (!response.ok) {
      throw new AcmeError(response.status, await response.text())
    }

    return response.json() as Promise<T>
  }

  return {
    invoices: {
      list: (filter?: { status?: Invoice['status'] }) =>
        request<Invoice[]>(filter?.status ? `/invoices?status=${filter.status}` : '/invoices'),
      create: (input: CreateInvoice) =>
        request<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(input) }),
      /** Starts a card payment. Returns the Stripe client secret to confirm it in the browser. */
      pay: (id: number) =>
        request<{ clientSecret: string }>(`/invoices/${id}/pay`, { method: 'POST' }),
    },
  }
}
