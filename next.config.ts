import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ExcelJS usa APIs de Node (zip, streams): se carga en el servidor sin empaquetarlo.
  serverExternalPackages: ['exceljs'],
  experimental: {
    serverActions: {
      // Las fotos de facturas se comprimen en el celular (unos 300 KB), pero dejamos margen.
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
