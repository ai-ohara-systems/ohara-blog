import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog', ({ data }) => data.lang === 'en');
  return rss({
    title: 'ohara.systems Blog',
    description: 'AI infrastructure insights — LLMOps, routing, cost optimization and more.',
    site: context.site,
    items: posts
      .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
      .map(post => ({
        title: post.data.title,
        pubDate: new Date(post.data.date),
        description: post.data.description,
        link: `/en/${post.id.replace('en/', '')}`,
      })),
    customData: '<language>en</language>',
  });
}
