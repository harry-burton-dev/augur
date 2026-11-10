// Puts each page's status on its sidebar link, so Beta and Planned pages are marked wherever they're listed.
// A Stable page carries no badge: that's what a reader assumes.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';
import { STATUS_LABEL, STATUS_VARIANT, type Status } from './status';


const slug = (href: string, base: string) =>
  href.replace(/[?#].*$/, '').replace(new RegExp(`^${base.replace(/\/$/, '')}`), '').replace(/^\/|\/$/g, '');

let statuses: Map<string, Status> | undefined;

export const onRequest = defineRouteMiddleware(async (context) => {
  statuses ??= new Map((await getCollection('docs')).map((page) => [page.id, page.data.status as Status]));
  const base = import.meta.env.BASE_URL;
  type Entry = (typeof context.locals.starlightRoute.sidebar)[number];
  const mark = (entries: Entry[]) => {
    for (const entry of entries) {
      if (entry.type === 'group') mark(entry.entries);
      else if (!entry.badge) {
        const status = statuses!.get(slug(entry.href, base));
        if (status && status !== 'stable') entry.badge = { text: STATUS_LABEL[status], variant: STATUS_VARIANT[status] };
      }
    }
  };
  mark(context.locals.starlightRoute.sidebar);
});
