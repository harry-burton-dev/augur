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

/**
 * Addresses that are never another machine's service: this host, "any" and link-local. The deployment's
 * own networks (where AUGUR's parts sit) come from the runner, which tells the registry at start (spec 9.8).
 */
const v4Refused: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8, "this network"
  [0x7f000000, 8], // 127.0.0.0/8, loopback
  [0xa9fe0000, 16], // 169.254.0.0/16, link-local (and cloud metadata)
];

/** The deployment's own networks, as CIDRs (`172.18.0.0/16`, `fd00:a::/64`), which the runner says at start. */
export interface OwnNetworks {
  networks: readonly string[];
}

/** An IPv6 address as eight 16-bit groups, or undefined when it isn't one. */
const v6 = (ip: string): number[] | undefined => {
  if (!/^[0-9a-f:]+$/i.test(ip) || (ip.match(/::/g) ?? []).length > 1) return undefined;
  const [head = '', tail] = ip.split('::');
  const a = head ? head.split(':') : [];
  const b = tail === undefined ? [] : tail ? tail.split(':') : [];
  const missing = 8 - a.length - b.length;
  if ((tail === undefined && missing !== 0) || missing < 0) return undefined;
  const groups = [...a, ...Array<string>(tail === undefined ? 0 : missing).fill('0'), ...b];
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return undefined;
  return groups.map((g) => parseInt(g, 16));
};

/** Whether `bits` leading bits of two addresses, as lists of `width`-bit groups, agree. */
const samePrefix = (x: number[], y: number[], bits: number, width: number) => {
  for (let i = 0; bits > 0; i++, bits -= width) {
    const take = Math.min(bits, width);
    if (Math.floor(x[i]! / 2 ** (width - take)) !== Math.floor(y[i]! / 2 ** (width - take))) return false;
  }
  return true;
};

/** The own network `host` (an IP literal as URL writes it) sits on, or undefined. A CIDR that isn't one is skipped. */
const ownNetworkOf = (host: string, own: readonly string[]): string | undefined => {
  const ip4 = v4(host);
  const ip6 = host.startsWith('[') ? v6(host.slice(1, -1)) : undefined;
  for (const cidr of own) {
    const [base = '', len] = cidr.split('/');
    const bits = Number(len);
    if (ip4 !== undefined && v4(base) !== undefined && Number.isInteger(bits) && bits >= 0 && bits <= 32) {
      if (bits === 0 || inV4(ip4, [v4(base)!, bits])) return cidr;
    }
    const b6 = v6(base);
    if (ip6 && b6 && Number.isInteger(bits) && bits >= 0 && bits <= 128 && samePrefix(ip6, b6, bits, 16)) return cidr;
  }
  return undefined;
};

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
  const why = `${host} is this machine or a link-local address, never another machine's service. Give the app's host name instead.`;
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

/**
 * Why `url` can't be where an app's service is: plain http(s) to a host and port, nothing else, and not
 * on one of the deployment's own networks (`own`, from the runner). Undefined when it can.
 */
export const upstreamProblem = (url: string, own: OwnNetworks = { networks: [] }): string | undefined => {
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
  const network = ownNetworkOf(host, own.networks);
  if (network) return `${host} is on ${network}, one of this deployment's own networks, where AUGUR's parts run. Give the app's host name, or an address outside it.`;
  if (!host.includes('.') && !host.startsWith('[') && !APP_CONTAINER.test(host)) {
    return `${host} isn’t an app’s container: on AUGUR’s own network only app-<id> names are apps (such as app-expenses). An app elsewhere needs its full host name.`;
  }
  // A dotted name whose first label is one of AUGUR's parts, such as identity.platform_default.
  const first = host.split('.')[0]!;
  if (PLATFORM_HOSTS.includes(first) || first.startsWith('platform-') || first.startsWith('platform_')) return `${host} is part of AUGUR, not an app’s service.`;
  return undefined;
};
