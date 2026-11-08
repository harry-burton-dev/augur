// `@augur/mfe-sdk/sdk3`: the app contract's frontend types (contract 3). Apps on SDK 2 import the
// package root and see nothing of this; the shell's worker host and SDK 3 apps import this path.
export * from './context.js';
export type { Intent, WorkspaceKind } from '../contract.js';
