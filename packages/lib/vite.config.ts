import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: {
        'token-sync': resolve(__dirname, 'src/index.ts'),
        'node': resolve(__dirname, 'src/node.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['http'],
    },
  },
});
