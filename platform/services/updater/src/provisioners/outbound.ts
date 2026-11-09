/**
 * augur-outbound: the internet, once the admin allows it for the app (spec 4.6, D4-A). It gives the part
 * nothing to read. An app's network is internal, so until an admin can allow it the part reaches no
 * further than its app's network and what joins it; Admin shows the ask in the review.
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
