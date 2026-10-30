// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Set SITE_URL in Cloudflare once the domain is known.
  site: process.env.SITE_URL ?? 'https://lightning-apps.pages.dev',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
