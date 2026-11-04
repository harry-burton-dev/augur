// For apps' tests, not their runtime code: `@augur/mfe-sdk/testing`. Needs `msw` installed.
export { fakeContext, TEST_BASE, type FakeContext, type FakeContextOptions, type FakeReply, type IntentAnswer } from './context.js';
export {
  contractHandlers,
  type ContractAnswer,
  type ContractHandlerOptions,
  type ContractRequest,
  type OpenApiDocument,
} from './openapi.js';
