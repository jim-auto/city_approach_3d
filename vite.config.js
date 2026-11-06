import { defineConfig } from 'vite';

export default defineConfig({
  // A relative base also supports GitHub Pages repository subpaths.
  base: './',
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
