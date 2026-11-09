/**
 * augur-outbound: the internet, once the admin allows it for the app (spec 4.6, D4-A). It gives the part
 * nothing to read. Until each app has a network of its own (P3b), parts share the platform's network,
 * so this provisioner only checks the ask; Admin shows it in the review.
 */
import type { Provisioner } from './types.ts';

export const outbound: Provisioner = {
  type: 'augur-outbound',
  uri: 'template://augur/outbound',
  params: ['hosts', 'why'],
  check: ({ hosts, why }) => [
    ...(hosts === undefined || (Array.isArray(hosts) && hosts.every((h) => typeof h === 'string' && h.length > 0)) ? [] : ['hosts is a list of host names.']),
    ...(typeof why === 'string' && why.trim() ? [] : ['why is required: what the app fetches, in words the admin reads.']),
  ],
  needs: [],
  outputs: () => ({}),
  compose: () => ({}),
};
