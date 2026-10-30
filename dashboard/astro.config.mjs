// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Local-only admin. Never deploy this app.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: '127.0.0.1', port: 4322 },
  security: { checkOrigin: true },
  devToolbar: { enabled: false },
});
