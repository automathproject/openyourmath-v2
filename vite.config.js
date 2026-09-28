import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    // Les specs de tests/e2e sont pilotées par Playwright : leur import de
    // `@playwright/test` fait échouer la collecte de Vitest. Les worktrees de
    // .claude/ portent les tests de leur branche, pas ceux de main.
    exclude: ['**/node_modules/**', '**/.svelte-kit/**', 'tests/e2e/**', '.claude/**']
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      ignored: ['**/content/**', '**/cache/**', '**/reports/**', '**/static/artifacts/**']
    }
  }
});
