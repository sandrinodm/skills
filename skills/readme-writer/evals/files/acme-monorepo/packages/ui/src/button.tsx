import type { ButtonHTMLAttributes } from 'react'

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="acme-button" {...props} />
}
