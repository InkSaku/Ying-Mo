import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const backendRoot = fileURLToPath(new URL('../backend/', import.meta.url))

export default defineConfig(({ mode }) => {
  const frontendEnv = loadEnv(mode, frontendRoot, 'VITE_')
  const backendEnv = loadEnv(mode, backendRoot, 'VITE_')
  const browserMapAk = frontendEnv.VITE_BAIDU_MAP_BROWSER_AK
    || backendEnv.VITE_BAIDU_MAP_BROWSER_AK
    || ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_BAIDU_MAP_BROWSER_AK': JSON.stringify(browserMapAk),
    },
    server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
    },
  }
})
