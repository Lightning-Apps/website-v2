import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getNews } from '../../lib/content';
import { localeStaticPaths, localizePath, type Locale } from '../../i18n/ui';
import { pick } from '@lightning/shared';

export const getStaticPaths = localeStaticPaths;

export async function GET(context: APIContext) {
  const lang = context.params.lang as Locale;
  const news = await getNews();
  return rss({
    title: 'Lightning Apps Newsroom',
    description: lang === 'de' ? 'Neuigkeiten von Lightning Apps' : 'News from Lightning Apps',
    site: context.site!,
    customData: `<language>${lang}</language>`,
    items: news.map((item) => ({
      title: pick(item, 'title', lang),
      description: pick(item, 'summary', lang),
      pubDate: new Date(`${item.published_at}T12:00:00Z`),
      link: localizePath(lang, `newsroom/${item.slug}`),
      categories: [item.category],
    })),
  });
}
