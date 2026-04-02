import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://blog.ohara.systems',
  vite: {
    plugins: [tailwindcss()],
  },
});
