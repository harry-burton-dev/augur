// `@augur/mfe-sdk/sdk3`: the app contract's frontend types (contract 3). Apps on SDK 2 import the
// package root and see nothing of this; the shell's worker host and SDK 3 apps import this path.
export * from './context.js';
export type { Intent, WorkspaceKind } from '../contract.js';
// A reference to another app's thing, and the errors an answered or closed intent rejects with, so an app on
// contract 3 needn't reach into the package root for them (PER-468).
export { isMarkingOrNone, isRef, type Marking, type Ref } from '../refs.js';
export { IntentCancelled, IntentError, isIntentCancelled } from '../intents.js';
