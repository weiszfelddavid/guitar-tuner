/// <reference types="vitest" />
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait()
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es',
    plugins: () => [
      wasm(),
      topLevelAwait()
    ]
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure worklet files are generated as separate chunks
        manualChunks(id) {
          if (id.includes('tuner-processor')) {
            return 'tuner-processor';
          }
        }
      }
    }
  },
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'jsdom', // or 'happy-dom'
  },
});