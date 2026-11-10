/**
 * augur-floor-graphs: where the floor graphs API answers, through the gateway; its routes and scopes are that service's (spec 4.6).
 * Its params say what the app needs of the knowledge graph: the classes it reads and writes and the actions it
 * takes. The registry checks them against the deployment's knowledge graph at install; here only their shape.
 */
import { GATEWAY_INSIDE, type Provisioner } from './types.ts';

/** The floor graphs API behind the gateway (the knowledge graph specification's server URL). */
export const FLOOR_GRAPHS_PATH = '/api/knowledge/v1';

const CLASS = /^[A-Za-z][A-Za-z0-9.+-]*:\S{1,200}$/;
const ACTION = /^[a-z][a-z0-9-]{1,60}$/;

/** Why a list param isn't a list of what it should be, or undefined when it is (or isn't given). */
const listProblem = (value: unknown, name: string, item: RegExp, what: string) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100 || !value.every((v) => typeof v === 'string' && item.test(v))) return `${name} is a list of up to 100 ${what}.`;
  return new Set(value).size === value.length ? undefined : `${name} names one of them twice.`;
};

export const floorGraphs: Provisioner = {
  type: 'augur-floor-graphs',
  uri: 'template://augur/floor-graphs',
  params: ['classes', 'actions'],
  check: ({ classes, actions }) =>
    [listProblem(classes, 'classes', CLASS, 'class IRIs, such as kg:Ship'), listProblem(actions, 'actions', ACTION, 'action names, such as retain')].filter((p): p is string => p !== undefined),
  needs: [],
  outputs: () => ({ url: { value: `${GATEWAY_INSIDE}${FLOOR_GRAPHS_PATH}` } }),
  compose: () => ({}),
};
