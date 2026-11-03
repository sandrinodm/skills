import type { ReactNode } from 'react'

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="acme-card">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
