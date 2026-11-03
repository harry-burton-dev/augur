// Typed clients for AUGUR's platform APIs. Everything per service (its types, `services`, and the
// `<service>Client` factories) is generated from contracts/*.openapi.yaml: change the service, not this.
export { DEFAULT_GATEWAY, serviceClient, throughPathFetch, type PathFetch, type ServiceClientOptions } from './client.js';
export * from './generated/index.js';
