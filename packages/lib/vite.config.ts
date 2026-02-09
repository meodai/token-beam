import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TokenSync',
      formats: ['es'],
      fileName: 'token-sync',
    },
    rollupOptions: {
      external: ['http'],
    },
  },
});
