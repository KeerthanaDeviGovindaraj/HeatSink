import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static single-page app, no backend. The browser reads only /public/data/*.json at runtime.
export default defineConfig({
  plugins: [react()],
});
