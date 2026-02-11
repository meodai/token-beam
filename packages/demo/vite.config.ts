import { defineConfig } from 'vite';
import { createCollection } from '../lib/dist/token-beam.js';
import { generateRandomRamp } from './src/colors';

export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [
    {
      name: 'token-beam-api',
      configureServer(server) {
        server.middlewares.use('/api/colors', (_req, res) => {
          const { colors } = generateRandomRamp();
          const payload = createCollection('token-sync-demo', colors);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.end(JSON.stringify(payload));
        });
      },
    },
  ],
});
