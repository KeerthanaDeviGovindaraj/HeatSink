/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// If deploying to GitHub Pages, set base to '/<repo-name>/' (e.g. '/HeatSink/').
// Netlify/Amplify can keep base '/'.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
});
