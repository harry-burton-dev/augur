// AUGUR's documentation site, built with Starlight. Where it's published comes from the build's
// environment, never from here: DOCS_SITE_URL is the site's origin and DOCS_BASE the path it's
// served under (`/` unless set).
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';
import { readdirSync } from 'node:fs';

// Every API AUGUR publishes has one OpenAPI file in contracts/ (one source per API). Each becomes a section of
// the reference, so a new API appears here without a change to this file.
const contracts = new URL('../contracts/', import.meta.url);
const apis = readdirSync(contracts)
  .filter((f) => f.endsWith('.openapi.yaml'))
  .sort()
  .map((f) => {
    const name = f.replace('.openapi.yaml', '');
    return {
      base: `reference/api/${name}`,
      schema: `../contracts/${f}`,
      sidebar: { label: `${name[0].toUpperCase()}${name.slice(1)} API` },
    };
  });

export default defineConfig({
  site: process.env.DOCS_SITE_URL || undefined,
  base: process.env.DOCS_BASE || '/',
  integrations: [
    starlight({
      title: 'AUGUR',
      plugins: [starlightOpenAPI(apis)],
      description: 'Run AUGUR, administer it and build apps for it.',
      social: [{ icon: 'github', label: 'Source', href: 'https://github.com/harry-burton-dev/augur' }],
      editLink: { baseUrl: 'https://github.com/harry-burton-dev/augur/edit/main/docs/' },
      lastUpdated: true,
      routeMiddleware: './src/lib/status-badges.ts',
      components: { PageTitle: './src/components/PageTitle.astro' },
      sidebar: [
        { label: 'Get started', items: [{ autogenerate: { directory: 'get-started' } }] },
        { label: 'Run AUGUR', items: [{ autogenerate: { directory: 'run' } }] },
        { label: 'Administer', items: [{ autogenerate: { directory: 'administer' } }] },
        { label: 'Build apps', items: [{ autogenerate: { directory: 'build' } }] },
        {
          label: 'Reference',
          items: [
            'reference',
            { label: 'Schemas and settings', items: [{ autogenerate: { directory: 'reference/schemas' } }] },
            ...openAPISidebarGroups,
          ],
        },
        { label: 'Release notes', collapsed: true, items: [{ autogenerate: { directory: 'release-notes' } }] },
        { label: 'Planned', collapsed: true, items: [{ autogenerate: { directory: 'planned' } }] },
      ],
    }),
  ],
});
