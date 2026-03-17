import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        popup: resolve(__dirname, 'src/ui/popup.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
        dir: 'dist',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
