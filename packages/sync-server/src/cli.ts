#!/usr/bin/env node
import { TokenSyncServer } from './server';

const port = parseInt(process.env.PORT || '8080', 10);
const server = new TokenSyncServer(port);

server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await server.stop();
  process.exit(0);
});
