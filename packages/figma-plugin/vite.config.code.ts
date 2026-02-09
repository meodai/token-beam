import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/code.ts'),
      name: 'TokenSyncPlugin',
      formats: ['iife'],
      fileName: () => 'code.js',
    },
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
