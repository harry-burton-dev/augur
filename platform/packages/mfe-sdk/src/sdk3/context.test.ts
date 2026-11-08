import { describe, expect, it } from 'vitest';
import { CONTRACT_MAJOR, defineApp, type AppContext, type RemoteElement } from './index.js';

describe('SDK 3 context', () => {
  it('speaks contract 3 and hands an app’s start back unchanged', () => {
    expect(CONTRACT_MAJOR).toBe(3);
    const start = defineApp((ctx: AppContext) => {
      const tree: RemoteElement = { type: 'quill-page-head', props: { title: ctx.person.name } };
      ctx.frame.screen.render(tree);
    });
    expect(typeof start).toBe('function');
  });
});
