import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const sherpaAssetsDir = path.resolve(rootDir, 'node_modules/@anov/sherpa-web/assets')

const assetMime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.onnx': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
}

// 把 sherpa-web 的 WASM / data / VAD / tokens 资源以 /sensevoice/ 提供，
// dev 用中间件直出，build 时复制到 dist/sensevoice/。不设置任何 COOP/COEP 响应头。
function sensevoiceAssets() {
  const serve = (req, res, next) => {
    const relative = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '')
    const filePath = path.resolve(sherpaAssetsDir, relative)
    if (!filePath.startsWith(sherpaAssetsDir + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      next()
      return
    }
    res.setHeader('Content-Type', assetMime[path.extname(filePath).toLowerCase()] || 'application/octet-stream')
    fs.createReadStream(filePath).pipe(res)
  }

  return {
    name: 'sensevoice-assets',
    configureServer(server) {
      server.middlewares.use('/sensevoice/', serve)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/sensevoice/', serve)
    },
    closeBundle() {
      const dest = path.resolve(rootDir, 'dist/sensevoice')
      fs.mkdirSync(dest, { recursive: true })
      for (const file of fs.readdirSync(sherpaAssetsDir)) {
        const src = path.join(sherpaAssetsDir, file)
        if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(dest, file))
      }
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), sensevoiceAssets()],
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        sensevoice: resolve(rootDir, 'sensevoice-test.html'),
      },
    },
  },
})
