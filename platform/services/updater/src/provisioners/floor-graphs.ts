/** augur-floor-graphs: where the floor graphs API answers, through the gateway; its routes and scopes are that service's (spec 4.6). */
import { GATEWAY_INSIDE, type Provisioner } from './types.ts';

/** The floor graphs API behind the gateway (the knowledge graph specification's server URL). */
export const FLOOR_GRAPHS_PATH = '/api/knowledge/v1';

export const floorGraphs: Provisioner = {
  type: 'augur-floor-graphs',
  uri: 'template://augur/floor-graphs',
  params: [],
  check: () => [],
  needs: [],
  outputs: () => ({ url: { value: `${GATEWAY_INSIDE}${FLOOR_GRAPHS_PATH}` } }),
  compose: () => ({}),
};
