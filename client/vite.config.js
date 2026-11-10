import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Dev-only: emulate Vercel serverless functions so /api/* endpoints
// (send-payment-notice, send-status-notice) work on `npm run dev`.
// Without this, fetch('/api/...') hits Vite's 404 and email can never send.
function localApi() {
  return {
    name: 'gateqr-local-api',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        const run = async () => {
          const name = req.url.split('?')[0].replace(/^\/+|\/+$/g, '');
          const file = path.join(rootDir, 'api', `${name}.js`);
          if (!/^[a-z0-9-]+$/i.test(name)) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Not found' }));
          }
          const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
          const handler = mod.default;
          if (typeof handler !== 'function') {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Not found' }));
          }
          req.body = await new Promise((resolve) => {
            const chunks = [];
            req.on('data', (c) => chunks.push(c));
            req.on('end', () => {
              try {
                resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
              } catch {
                resolve({});
              }
            });
            req.on('error', () => resolve({}));
          });
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
            return res;
          };
          await handler(req, res);
        };
        run().catch((e) => {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Local API error', detail: String(e?.message || e) }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env vars (including non-VITE_* like RESEND_API_KEY / SMTP_*) into
  // process.env so the local /api handlers can read them like on Vercel.
  const env = loadEnv(mode, rootDir, '');
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return { plugins: [react(), localApi()], server: { port: 5173 } };
});
