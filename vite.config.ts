import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { getRequestListener } from '@hono/node-server';

/** Serves the Hono API from the Vite dev server so `pnpm dev` runs the whole app in one process. */
function devApi(): Plugin {
  return {
    name: 'inoffice-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        // Load through Vite so server code picks up edits without a restart.
        server.ssrLoadModule('/server/app.ts')
          .then(({ app }) => getRequestListener(app.fetch)(req, res))
          .catch(next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Expose non-VITE_ variables from .env files to server code in development, as Vercel does in production.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[key] ??= value;
  return {
    plugins: [react(), tailwindcss(), devApi()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  };
});
