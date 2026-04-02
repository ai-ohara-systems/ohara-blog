import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    tag: z.string(),
    tagColor: z.string().default('#38bdf8'),
    readTime: z.string(),
    lang: z.enum(['en', 'de']).default('en'),
  }),
});

export const collections = { blog };
