import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      ignored: ['**/content/**', '**/cache/**', '**/reports/**', '**/static/artifacts/**']
    }
  }
});
