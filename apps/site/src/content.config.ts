// The docs live at the repository root (docs/), not inside this app: they are the spec for humans and agents
// alike and must be readable straight from the repo. The glob base is the repo root so every page id starts
// with `docs/`, which puts the whole documentation under /docs/ and leaves / free for the landing page.

import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { glob } from 'astro/loaders';

export const collections = {
  docs: defineCollection({
    loader: glob({ base: '../..', pattern: 'docs/**/[^_]*.{md,mdx}' }),
    schema: docsSchema(),
  }),
};
