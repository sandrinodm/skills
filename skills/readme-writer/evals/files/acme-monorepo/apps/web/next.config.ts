import type { NextConfig } from 'next'

const config: NextConfig = {
  // @acme/ui ships TypeScript source, so Next.js compiles it.
  transpilePackages: ['@acme/ui'],
}

export default config
