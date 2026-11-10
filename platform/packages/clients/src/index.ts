// Typed clients for AUGUR's platform APIs. Everything per service (its types, `services`, and the
// `<service>Client` factories) is generated from contracts/*.openapi.yaml: change the service, not this.
export { DEFAULT_GATEWAY, serviceClient, throughPathFetch, type PathFetch, type ServiceClientOptions } from './client.js';
export * from './generated/index.js';
// The knowledge graph's actions, bound from its catalogue when the client connects.
export {
  connectKnowledge,
  KnowledgeUnavailable,
  type ActAnswer,
  type ActOptions,
  type KnowledgeAction,
  type KnowledgeActionResult,
  type KnowledgeBaseClass,
  type KnowledgeClass,
  type KnowledgeConnection,
  type KnowledgeProblem,
} from './knowledge.js';
