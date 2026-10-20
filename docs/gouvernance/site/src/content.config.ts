import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { gouvernanceLoader } from './loader';

// Les .md sont lus dans docs/gouvernance (deux niveaux au-dessus de ce fichier)
export const collections = {
  docs: defineCollection({
    loader: gouvernanceLoader(new URL('../../', import.meta.url)),
    schema: docsSchema(),
  }),
};
