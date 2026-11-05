/**
 * What's new in the release this shell ships in, for people, shown in Account → About and help. Write
 * it for whoever uses AUGUR, not as a changelog: what they can now do, and where. `{product}` stands for
 * the deployment's name for AUGUR (ORG_PRODUCT_NAME). Each minor release replaces it (docs/versioning.md).
 */
export interface WhatsNew {
  /** The AUGUR release it's for, and that release's name (release/augur-release.json). */
  version: string;
  name: string;
  summary: string;
  items: { title: string; text: string }[];
}

export const WHATS_NEW: WhatsNew = {
  version: '0.22.0',
  name: 'Ibis',
  summary: 'Ibis is the release {product}’s first testers start on.',
  items: [
    {
      title: 'Your organisation’s own name',
      text: '{product} shows your organisation’s name and time zone, which an admin sets in Admin → Organisation, and its emails come from the organisation’s own sender.',
    },
    {
      title: 'When someone leaves',
      text: 'An admin can mark someone as leaving and name who takes over their work. Turning a sign-in off signs that person out everywhere at once, and People shows where each account stands and when it last signed in.',
    },
    {
      title: 'Activity you can take away',
      text: 'Admin → Activity narrows to one kind of change and downloads as a spreadsheet (CSV). Sign-ins show there too.',
    },
    {
      title: 'A first look at a new design',
      text: 'Home offers two feature previews: what needs you comes forward, and a ring of actions on each thing. Turn them on in Previews, at the top of the shell, and off the same way.',
    },
    {
      title: 'Desktops without a graphics card',
      text: 'Where your organisation’s desktops have no graphics card, an admin can have dialogs and menus dim what’s behind them instead of blurring it, which is quicker there.',
    },
  ],
};

/** The release's What's new with the deployment's name for AUGUR in it. */
export const whatsNewFor = (product: string, news: WhatsNew = WHATS_NEW): WhatsNew => {
  const named = (s: string) => s.replaceAll('{product}', product);
  return { ...news, summary: named(news.summary), items: news.items.map((i) => ({ title: named(i.title), text: named(i.text) })) };
};
