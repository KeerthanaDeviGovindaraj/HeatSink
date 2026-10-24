import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static single-page app, no backend. The browser reads only /public/data/*.json at runtime.
//
// Deployed to GitHub Pages as a PROJECT site at https://<owner>.github.io/HeatSink/,
// so assets must be served under the "/HeatSink/" base. Override with the
// BASE_PATH env var for other hosts (Netlify/Amplify use "/").
const base = process.env.BASE_PATH ?? '/HeatSink/';

export default defineConfig({
  base,
  plugins: [react()],
});
