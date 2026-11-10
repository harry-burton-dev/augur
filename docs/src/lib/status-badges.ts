// Marks Planned pages on their sidebar links, so nobody mistakes them for what AUGUR does today. Stable and
// Beta show only under the page's title: while all of AUGUR is in beta, a Beta badge on every link says nothing.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';
import { STATUS_LABEL, STATUS_VARIANT, type Status } from './status';


const slug = (href: string, base: string) =>
  href.replace(/[?#].*$/, '').replace(new RegExp(`^${base.replace(/\/$/, '')}`), '').replace(/^\/|\/$/g, '');

let statuses: Map<string, Status> | undefined;

export const onRequest = defineRouteMiddleware(async (context) => {
  if (!statuses) {
    const pages = await getCollection('docs');
    const missing = pages.filter((page) => !page.data.status).map((page) => page.filePath ?? page.id);
    if (missing.length) throw new Error(`Every page needs a status (stable, beta or planned) in its front matter: ${missing.join(', ')}`);
    statuses = new Map(pages.map((page) => [page.id, page.data.status as Status]));
  }
  const base = import.meta.env.BASE_URL;
  type Entry = (typeof context.locals.starlightRoute.sidebar)[number];
  const mark = (entries: Entry[]) => {
    for (const entry of entries) {
      if (entry.type === 'group') mark(entry.entries);
      else if (!entry.badge) {
        const status = statuses!.get(slug(entry.href, base));
        if (status === 'planned') entry.badge = { text: STATUS_LABEL[status], variant: STATUS_VARIANT[status] };
      }
    }
  };
  mark(context.locals.starlightRoute.sidebar);
});
