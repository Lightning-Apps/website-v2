// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

const secret = () => envField.string({ context: 'server', access: 'secret', optional: true });

// Admin app: runs locally (`npm run dashboard`) or as a container on the home server.
// It is never deployed publicly.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: '127.0.0.1', port: 4322 },
  // Origin and host checks happen in src/middleware.ts so they also work behind a reverse proxy.
  security: { checkOrigin: false },
  devToolbar: { enabled: false },
  // Secrets are read from the environment at runtime, never baked into the build.
  env: {
    schema: {
      // Supabase project URL
      SUPABASE_URL: secret(),
      // Supabase secret / service_role key
      SUPABASE_SERVICE_ROLE_KEY: secret(),
      // Cloudflare Pages deploy hook
      CF_DEPLOY_HOOK_URL: secret(),
      // Public website URL
      SITE_URL: secret(),
      // Login password hash (npm run hash-password -w dashboard)
      DASHBOARD_PASSWORD_HASH: secret(),
      // Random secret for signing login cookies
      DASHBOARD_SESSION_SECRET: secret(),
      // Comma-separated host:port values the dashboard answers to
      DASHBOARD_ALLOWED_HOSTS: secret(),
      // Directory for local state (deploy timestamp)
      DASHBOARD_DATA_DIR: secret(),
    },
    validateSecrets: false,
  },
});
