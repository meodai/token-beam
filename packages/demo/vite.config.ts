import { defineConfig } from 'vite';
import { createCollection } from 'figma-sync';
import { generateRandomRamp } from './src/colors';

// Generate a ramp at server start; regenerated on each /api/colors request
export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [
    {
      name: 'figma-sync-api',
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
