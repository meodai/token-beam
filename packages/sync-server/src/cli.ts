#!/usr/bin/env node
import { TokenSyncServer } from './server.js';

const port = parseInt(process.env.PORT || '8080', 10);
const server = new TokenSyncServer(port);

server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);
  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 5000);
  forceExit.unref();
  await server.stop();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
