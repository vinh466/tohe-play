import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';
import { remarkRepoLinks } from './src/plugins/remark-repo-links.ts';

export default defineConfig({
  site: process.env.TOHE_SITE_URL ?? 'http://localhost:4710',
  server: { port: 4710 },
  markdown: { remarkPlugins: [remarkRepoLinks] },
  integrations: [
    mermaid({ theme: 'neutral', autoTheme: true }),
    starlight({
      title: 'Tò He Docs',
      description: 'Developer documentation for the Tò He mini-game platform.',
      logo: { src: './public/favicon.svg' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/vinh466/tohe-play' }],
      customCss: ['./src/styles/docs.css'],
      lastUpdated: true,
      plugins: [
        starlightOpenAPI([
          {
            base: 'docs/reference/api',
            schema: '../../services/api/openapi/tohe-api.json',
            sidebar: { label: 'Platform API (generated)' },
          },
        ]),
        starlightLlmsTxt({ projectName: 'Tò He' }),
      ],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Overview', link: '/docs/' },
            { label: 'Vision & scope', link: '/docs/vision/' },
            { label: 'Local development', link: '/docs/guides/local-development/' },
          ],
        },
        { label: 'Architecture', items: [{ autogenerate: { directory: 'docs/architecture' } }] },
        { label: 'Contracts', items: [{ autogenerate: { directory: 'docs/contracts' } }] },
        { label: 'Guides', items: [{ autogenerate: { directory: 'docs/guides' } }] },
        { label: 'Conventions', items: [{ autogenerate: { directory: 'docs/conventions' } }] },
        {
          label: 'Decisions (ADR)',
          collapsed: true,
          items: [{ autogenerate: { directory: 'docs/decisions' } }],
        },
        { label: 'Roadmap', items: [{ autogenerate: { directory: 'docs/roadmap' } }] },
        ...openAPISidebarGroups,
      ],
    }),
  ],
});
