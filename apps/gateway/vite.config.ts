import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pengembangan lokal: /api/gateway diteruskan ke Back Office (pnpm dev:backoffice, port 6970) sehingga cookie
// sesi dan CSRF tetap satu alamat, sama seperti Caddy di staging/produksi (spec F2-7a §2a).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api/gateway': { target: process.env.GATEWAY_BACKOFFICE_URL ?? 'http://localhost:6970', changeOrigin: false } },
  },
})
