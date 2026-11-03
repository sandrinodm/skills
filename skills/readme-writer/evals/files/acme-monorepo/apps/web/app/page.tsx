import { createClient } from '@acme/sdk'
import { Card } from '@acme/ui'

const acme = createClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  apiKey: process.env.ACME_API_KEY ?? '',
})

export default async function InvoicesPage() {
  const invoices = await acme.invoices.list({ status: 'open' })

  return (
    <main>
      <h1>Open invoices</h1>
      {invoices.map((invoice) => (
        <Card key={invoice.id} title={invoice.number}>
          {(invoice.amountCents / 100).toFixed(2)} {invoice.currency}
        </Card>
      ))}
    </main>
  )
}
