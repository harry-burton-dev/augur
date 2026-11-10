import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { STATUSES } from './lib/status';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // Every page says how far along what it describes is. A page can't build without one.
        status: z.enum(STATUSES),
        // The AUGUR release the page was last checked against, such as `0.24.0`. A Planned page has none.
        checkedAgainst: z.string().optional(),
      }),
    }),
  }),
};
