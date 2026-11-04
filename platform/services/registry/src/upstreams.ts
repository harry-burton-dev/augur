/**
 * Names on the platform's own network that no app's service may be reached at: the gateway would
 * send people's calls, with a caller signed for the app, straight to the platform's own parts.
 */
export const PLATFORM_HOSTS = ['gateway', 'identity', 'registry', 'events', 'models', 'storage', 'updater', 'docker-proxy', 'keycloak', 'postgres', 'garage', 'web', 'tailscale', 'backup', 'localhost'];

/**
 * A name on the platform's own network that may be an app's service: the containers the updater and
 * the preview runner start are all `app-<id>-<slot>` or `app-<id>-pr<n>` (updater `serviceName`,
 * `previewId`). Any other name without a dot is one of AUGUR's own containers, or a Compose name
 * for one (such as `platform-identity-1`), so it is refused.
 */
export const APP_CONTAINER = /^app-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Addresses that are never another machine's service: this host, "any", link-local, and Docker's default range, where AUGUR's own containers sit. */
const v4Refused: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8, "this network"
  [0x7f000000, 8], // 127.0.0.0/8, loopback
  [0xa9fe0000, 16], // 169.254.0.0/16, link-local (and cloud metadata)
  [0xac100000, 12], // 172.16.0.0/12, Docker's default address pool
];

const v4 = (host: string): number | undefined => {
  const parts = host.split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return undefined;
  return parts.reduce((n, p) => n * 256 + Number(p), 0);
};

const inV4 = (n: number, [base, bits]: [number, number]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits));

/**
 * Why an IP literal (as WHATWG URL writes it: dotted IPv4, or IPv6 in brackets) can't be an app's
 * service, or undefined when it can. URL parsing has already turned 127.1, 0x7f.1 and 2130706433 into 127.0.0.1.
 */
const ipProblem = (host: string): string | undefined => {
  const why = `${host} is this machine, a link-local address or Docker's own range, where AUGUR's parts run. Give the app's host name instead.`;
  if (host.startsWith('[')) {
    const ip = host.slice(1, -1);
    // ::, ::1, fe80::/10, and IPv4-mapped (::ffff:a.b.c.d, which URL writes as ::ffff:7f00:1).
    if (ip === '::' || ip === '::1' || /^fe[89ab][0-9a-f]:/.test(ip)) return why;
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
    if (mapped) {
      const n = parseInt(mapped[1]!, 16) * 65536 + parseInt(mapped[2]!, 16);
      if (v4Refused.some((r) => inV4(n, r))) return why;
    }
    return undefined;
  }
  const n = v4(host);
  if (n !== undefined && v4Refused.some((r) => inV4(n, r))) return why;
  return undefined;
};

/** Why `url` can't be where an app's service is: plain http(s) to a host and port, nothing else. Undefined when it can. */
export const upstreamProblem = (url: string): string | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `"${url}" is not an address such as http://app-expenses:8090.`;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'An app’s service is reached over http or https.';
  if (parsed.username || parsed.password) return 'An app’s address can’t carry a user name or password.';
  if ((parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) return 'Give only the scheme, host and port: the gateway adds the path.';
  // "identity." is "identity": a trailing dot only makes a name absolute.
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (PLATFORM_HOSTS.includes(host) || host.endsWith('.localhost')) return `${host} is part of AUGUR, not an app’s service.`;
  const ip = ipProblem(host);
  if (ip) return ip;
  if (!host.includes('.') && !host.startsWith('[') && !APP_CONTAINER.test(host)) {
    return `${host} isn’t an app’s container: on AUGUR’s own network only app-<id> names are apps (such as app-expenses). An app elsewhere needs its full host name.`;
  }
  // A dotted name whose first label is one of AUGUR's parts, such as identity.platform_default.
  const first = host.split('.')[0]!;
  if (PLATFORM_HOSTS.includes(first) || first.startsWith('platform-') || first.startsWith('platform_')) return `${host} is part of AUGUR, not an app’s service.`;
  return undefined;
};
