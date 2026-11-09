import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { STATUSES } from './lib/status';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // How far along what the page describes is. Every page written in src/content/docs must say
        // (src/lib/status-badges.ts fails the build without it); pages generated from the code have none.
        status: z.enum(STATUSES).optional(),
        // The AUGUR release the page was last checked against, such as `0.24.0`. A Planned page has none.
        checkedAgainst: z.string().optional(),
      }),
    }),
  }),
};
