import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// USB / air-gapped builds want relative asset paths so index.html works from file://
export default defineConfig({
  base: './',
  plugins: [react()],
  // pRose gets its own port so it never collides with a stray server on Vite's
  // default 5173. strictPort:false lets it hop to the next free port if 5273 is taken.
  server: { host: true, port: 5273, strictPort: false },
});
