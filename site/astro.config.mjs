// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Set SITE_URL in Cloudflare once the domain is known.
  site: process.env.SITE_URL ?? 'https://lightning-apps.pages.dev',
  output: 'static',
  trailingSlash: 'always',
  // The dashboard builds previews under /preview into its own data folder.
  base: process.env.SITE_BASE || '/',
  outDir: process.env.SITE_OUT_DIR || './dist',
  cacheDir: process.env.SITE_CACHE_DIR || './node_modules/.astro',
  vite: process.env.SITE_CACHE_DIR ? { cacheDir: `${process.env.SITE_CACHE_DIR}/vite` } : {},
  integrations: [sitemap()],
});
