import { createServer, type Server } from 'http';
import type { FigmaSyncPayload } from './types';

export interface ServeOptions {
  port?: number;
  hostname?: string;
}

export function servePayload(
  payload: FigmaSyncPayload,
  options: ServeOptions = {},
): Promise<{ server: Server; url: string }> {
  const port = options.port ?? 3333;
  const hostname = options.hostname ?? 'localhost';
  const json = JSON.stringify(payload);

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(json);
    });

    server.listen(port, hostname, () => {
      const url = `http://${hostname}:${port}`;
      console.log(`figma-sync serving at ${url}`);
      resolve({ server, url });
    });
  });
}
