import { fileURLToPath } from 'node:url';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';
import { remarkRepoLinks } from './src/plugins/remark-repo-links.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const watched = [`${repoRoot}docs`, `${repoRoot}apps/docs`];

function watchIgnored(path: string): boolean {
  if (/[\\/](node_modules|\.git|\.turbo|\.astro|dist|\.out|bin|obj|test-results)([\\/]|$)/.test(path))
    return true;
  if (!path.startsWith(repoRoot)) return false;
  // Ignore everything in the repo except docs/ and apps/docs (and the directories leading to them).
  return !watched.some((dir) => path.startsWith(dir) || dir.startsWith(path.replace(/[\\/]$/, '')));
}

export default defineConfig({
  site: process.env.TOHE_DOCS_URL ?? 'http://localhost:4710',
  server: { port: 4710 },
  markdown: { remarkPlugins: [remarkRepoLinks] },
  // Sätteri (Astro 7's Markdown engine) loads its native binding relative to its own file. If Vite bundles it
  // into the prerender chunk the binding is not found (seen in the Docker build), so always load it from
  // node_modules; it is a direct dependency for that reason.
  vite: {
    ssr: { external: ['satteri'] },
    server: {
      // The docs are read from the repository root (src/content.config.ts), which makes the dev server watch the
      // whole monorepo and exhaust inotify watches. Only docs/ and this app matter.
      watch: { ignored: watchIgnored },
    },
  },
  integrations: [
    mermaid({ theme: 'neutral', autoTheme: true }),
    starlight({
      title: 'Tò He Docs',
      description: 'Developer documentation for the Tò He mini-game platform.',
      logo: { src: './public/favicon.svg' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/vinh466/tohe-play' }],
      customCss: ['@tohe/design-tokens/tokens.css', './src/styles/docs.css'],
      // The docs share the player's light/dark choice with the hub and the public pages (ADR 0013).
      components: {
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      lastUpdated: true,
      plugins: [
        starlightOpenAPI([
          {
            base: 'reference/api',
            schema: '../../services/api/openapi/tohe-api.json',
            sidebar: { label: 'Platform API (generated)' },
          },
          {
            // The admin console's API, a document of its own (ADR 0027).
            base: 'reference/admin-api',
            schema: '../../services/api/openapi/tohe-api_admin.json',
            sidebar: { label: 'Admin API (generated)' },
          },
        ]),
        starlightLlmsTxt({ projectName: 'Tò He' }),
      ],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Overview', link: '/' },
            { label: 'Vision & scope', link: '/vision/' },
            { label: 'Local development', link: '/guides/local-development/' },
          ],
        },
        { label: 'Architecture', items: [{ autogenerate: { directory: 'architecture' } }] },
        { label: 'Contracts', items: [{ autogenerate: { directory: 'contracts' } }] },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
        { label: 'Conventions', items: [{ autogenerate: { directory: 'conventions' } }] },
        {
          label: 'Decisions (ADR)',
          collapsed: true,
          items: [{ autogenerate: { directory: 'decisions' } }],
        },
        { label: 'Roadmap', items: [{ autogenerate: { directory: 'roadmap' } }] },
        { label: 'Research', items: [{ autogenerate: { directory: 'research' } }] },
        ...openAPISidebarGroups,
      ],
    }),
  ],
});
