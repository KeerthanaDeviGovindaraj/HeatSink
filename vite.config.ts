import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static single-page app, no backend. The browser reads only /public/data/*.json at runtime.
// If deploying to GitHub Pages, set base to '/<repo-name>/' (e.g. '/HeatSink/').
// Netlify/Amplify can keep base '/'.
export default defineConfig({
  plugins: [react()],
});
