// The docs live at the repository root (docs/), not inside this app: they are the spec for humans and agents
// alike and must be readable straight from the repo. The glob base is docs/ itself, so a page's id is its path
// without `docs/` and the whole documentation sits at the root of its host (ADR 0042): docs/guides/uat.md is
// /guides/uat/ and docs/index.md is /.

import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { glob } from 'astro/loaders';

export const collections = {
  docs: defineCollection({
    loader: glob({ base: '../../docs', pattern: '**/[^_]*.{md,mdx}' }),
    schema: docsSchema(),
  }),
};
