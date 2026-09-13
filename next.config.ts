import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos de facturas se comprimen en el celular (unos 300 KB), pero dejamos margen.
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
