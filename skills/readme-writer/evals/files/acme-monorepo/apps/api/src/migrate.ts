import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

await sql`
  create table if not exists invoices (
    id serial primary key,
    number text generated always as ('INV-' || lpad(id::text, 5, '0')) stored,
    customer_id text not null,
    amount_cents integer not null,
    currency text not null,
    status text not null,
    created_at timestamptz not null default now()
  )
`

await sql.end()
