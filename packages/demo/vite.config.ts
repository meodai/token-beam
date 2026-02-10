import { defineConfig } from 'vite';
import { createCollection } from 'token-sync';
import { generateRandomRamp } from './src/colors';

export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [
    {
      name: 'token-sync-api',
      configureServer(server) {
        server.middlewares.use('/api/colors', (_req, res) => {
          const { name, colors } = generateRandomRamp();
          const payload = createCollection(name, colors);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.end(JSON.stringify(payload));
        });
      },
    },
  ],
});
