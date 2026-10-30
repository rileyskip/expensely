import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function devPort(): number {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PORT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: devPort(),
  },
});
