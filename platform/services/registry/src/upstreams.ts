/**
 * Names on the platform's own network that no app's service may be reached at: the gateway would
 * send people's calls, with a caller signed for the app, straight to the platform's own parts.
 */
export const PLATFORM_HOSTS = ['gateway', 'identity', 'registry', 'events', 'models', 'storage', 'updater', 'docker-proxy', 'keycloak', 'postgres', 'garage', 'web', 'tailscale', 'backup', 'localhost'];

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
  const host = parsed.hostname.toLowerCase();
  if (PLATFORM_HOSTS.includes(host) || host.endsWith('.localhost') || host === '127.0.0.1' || host === '[::1]') return `${host} is part of the platform, not an app’s service.`;
  return undefined;
};
