// `@augur/mfe-sdk/sdk3/host`: the shell's side of the bridge to an app's worker. Only the shell
// imports it; what crosses is the SDK's own protocol, so an app never depends on it.
export { Channel, type Port, type Message, type Handler, type ChannelOptions } from './channel.js';
export { pathProblem, isHostHeader, responseToWire, HOST_HEADERS, type WireRequest, type WireResponse } from './fetch.js';
export { SCREEN_ROOT, CARD_ROOT, aboutRoot, type StartInit } from './runtime-names.js';
