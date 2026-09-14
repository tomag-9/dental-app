import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The config was deleted in 99110b8 together with the Tailwind setup, but
// @vitejs/plugin-react stayed in package.json — so the plugin was installed and
// never activated (#123). It is restored rather than dropped because #124
// migrates src/ from global scripts to real ES modules with JSX syntax, which
// needs exactly what this plugin provides: the automatic JSX runtime and Fast
// Refresh in dev. Keeping the config makes the dependency honest today and
// removes a prerequisite from that migration.
//
// Nothing else is configured on purpose: the entry point (index.html), the
// dev-server host/port (see the `dev`/`preview` npm scripts) and the API base
// URL (VITE_API_URL, read in src/main.js) all stay where they already are.
export default defineConfig({
  plugins: [react()],
});
