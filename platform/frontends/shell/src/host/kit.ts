/** The UI kit this page loads (ADR 0048): its version and the address its files come from, as the page names them. */
export interface PageKit {
  version: string;
  url: string;
}

export function pageKit(doc: Document = document): PageKit | undefined {
  const content = doc.querySelector('meta[name="augur-kit"]')?.getAttribute('content');
  if (!content) return undefined;
  try {
    const kit = JSON.parse(content) as Partial<PageKit>;
    return typeof kit.version === 'string' && typeof kit.url === 'string' ? { version: kit.version, url: kit.url } : undefined;
  } catch {
    return undefined;
  }
}

/** The shell's version line in Settings: the shell, the SDK, and the kit and where it is loaded from. */
export const versionLine = (shell: string, sdk: string, kit: PageKit | undefined) =>
  [shell, `SDK ${sdk}`, ...(kit ? [`kit ${kit.version} from ${kit.url}`] : [])].join(' · ');
