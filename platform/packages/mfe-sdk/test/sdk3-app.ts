// An app's entry, for runtime.test.ts: it draws one element and hands its context to the test.
import { defineApp, type AppContext } from '../src/sdk3/index.js';

export default defineApp((ctx: AppContext) => {
  (globalThis as { testCtx?: AppContext }).testCtx = ctx;
  ctx.frame.screen.render({ type: 'quill-notice', props: { heading: `Hello ${ctx.person.name}` }, children: 'On ' + ctx.workspace.name });
  return () => ((globalThis as { stopped?: boolean }).stopped = true);
});
