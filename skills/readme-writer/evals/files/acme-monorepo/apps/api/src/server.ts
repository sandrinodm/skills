import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import postgres from 'postgres'
import Stripe from 'stripe'

const DEFAULT_PORT = 8787

const databaseUrl = process.env.DATABASE_URL
const stripeKey = process.env.STRIPE_SECRET_KEY
const apiKey = process.env.API_KEY

if (!databaseUrl || !stripeKey || !apiKey) {
  throw new Error('DATABASE_URL, STRIPE_SECRET_KEY and API_KEY must be set (see apps/api/.env.example)')
}

// Return camelCase columns (amount_cents -> amountCents) to match the SDK's Invoice type.
const sql = postgres(databaseUrl, { transform: postgres.camel })
const stripe = new Stripe(stripeKey)
const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

app.use('/invoices*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${apiKey}`) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  await next()
})

app.get('/invoices', async (c) => {
  const status = c.req.query('status')
  const rows = status
    ? await sql`select * from invoices where status = ${status} order by created_at desc`
    : await sql`select * from invoices order by created_at desc`

  return c.json(rows)
})

app.post('/invoices', async (c) => {
  const body = await c.req.json()
  const [invoice] = await sql`
    insert into invoices (customer_id, amount_cents, currency, status)
    values (${body.customerId}, ${body.amountCents}, ${body.currency}, 'open')
    returning *
  `

  return c.json(invoice, 201)
})

app.post('/invoices/:id/pay', async (c) => {
  const [invoice] = await sql`select * from invoices where id = ${c.req.param('id')}`

  if (!invoice) {
    return c.json({ error: 'not found' }, 404)
  }

  const intent = await stripe.paymentIntents.create({ amount: invoice.amountCents, currency: invoice.currency })

  return c.json({ clientSecret: intent.client_secret })
})

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? DEFAULT_PORT) })
