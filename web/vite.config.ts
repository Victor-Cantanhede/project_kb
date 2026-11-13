import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function resolveApiPort(): string {
  if (process.env.API_PORT) return process.env.API_PORT;
  const apiEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../api/.env');
  if (existsSync(apiEnvPath)) {
    const match = /^PORT=(\d+)/m.exec(readFileSync(apiEnvPath, 'utf8'));
    if (match?.[1]) return match[1];
  }
  return '3000';
}

const apiTarget = `http://127.0.0.1:${resolveApiPort()}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
