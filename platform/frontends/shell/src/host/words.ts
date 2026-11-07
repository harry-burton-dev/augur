/**
 * The words the shell puts on the app bar (PDR-020): a deployment translates them here, never in the
 * kit. App names, lines and page names come from each app's manifest; the product's name from the
 * deployment (ORG_PRODUCT_NAME).
 */
export const BAR_WORDS = {
  platform: (product: string) => ({ name: 'Platform', line: `Using and managing ${product}` }),
  pillars: (product: string) => ({ name: 'Pillars', line: `The foundation of what ${product} makes` }),
  apps: () => ({ name: 'Apps', line: 'Everything else you can open here' }),
} as const;
