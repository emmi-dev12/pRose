import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// USB / air-gapped builds want relative asset paths so index.html works from file://
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
});
