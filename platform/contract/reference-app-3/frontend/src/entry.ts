/**
 * The reference app on the app contract (contract 3): it runs in the shell's worker and draws only
 * Quill's remote vocabulary. Each check is a notice whose heading names it and whose text is what it
 * found, for tests/contract3.spec.ts to read; each button is something a test presses.
 */
import { defineApp, type AppContext, type RemoteNode } from '@augur/mfe-sdk/sdk3';

const check = (name: string, found: string): RemoteNode => ({ type: 'quill-notice', props: { heading: `check ${name}` }, children: found });
const button = (label: string, onPress: () => void): RemoteNode => ({ type: 'quill-button', props: { label, onPress } });

export default defineApp((ctx: AppContext) => {
  const scope = globalThis as Record<string, unknown>;
  const network = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'indexedDB', 'caches', 'BroadcastChannel', 'Worker'].filter((name) => typeof scope[name] !== 'undefined');
  const tokenish = Object.keys(scope).filter((k) => /token/i.test(k));
  let path = ctx.path;
  let fetched = 'not yet';
  let flood = false;
  let commands = 0;
  let policy = 'not tried';
  // The worker's own Content-Security-Policy says what it may load: scripts from the shell's origin, nothing else.
  (globalThis as unknown as EventTarget).addEventListener('securitypolicyviolation', (e) => {
    policy = `held: ${(e as SecurityPolicyViolationEvent).effectiveDirective}`;
    draw();
  });

  const draw = () =>
    ctx.frame.screen.render([
      check('person', `${ctx.person.name} (${ctx.person.id})`),
      check('floor', `${ctx.workspace.id} ${ctx.workspace.kind}`),
      check('path', path),
      // The worker has remote-dom's DOM, never the shell's page: none of its storage or cookies.
      check('worker', `network: ${network.join(',') || 'none'}; document: ${typeof (scope.document as { createElement?: unknown })?.createElement}; page: ${['localStorage', 'sessionStorage', 'cookieStore'].filter((k) => typeof scope[k] !== 'undefined').join(',') || 'none'}; token: ${tokenish.join(',') || 'none'}`),
      check('previews', `turned-on:${ctx.previewOn('turned-on') ? 'on' : 'off'} not-declared:${ctx.previewOn('not-declared') ? 'on' : 'off'}`),
      check('fetched', fetched),
      check('commands', String(commands)),
      check('policy', policy),
      // Not in Quill's remote vocabulary: the host drops it, with a reason on the console.
      { type: 'evil-frame', props: { src: 'https://example.org/' } },
      button('Fetch', () => {
        void ctx.fetch('/api/reference3/v1/echo', { headers: { authorization: 'Bearer forged', 'x-augur-app': 'someone-else' } }).then(
          async (res) => {
            fetched = `${res.status} ${await res.text()}`;
            draw();
          },
          (err: Error) => {
            fetched = `failed: ${err.message}`;
            draw();
          },
        );
      }),
      button('Fetch an address', () => {
        void ctx.fetch('https://example.org/api/x').catch((err: Error) => {
          fetched = `refused: ${err.name}`;
          draw();
        });
      }),
      button('Load from elsewhere', () => {
        void import(/* @vite-ignore */ 'https://example.org/module.js').catch(() => undefined);
      }),
      button('Go to claims', () => ctx.navigate('/claims/7')),
      button('Throw', () => {
        setTimeout(() => {
          throw new Error('The reference app threw on purpose.');
        });
      }),
      button('Flood', () => {
        flood = true;
        draw();
      }),
      ...(flood ? Array.from({ length: 2001 }, (_, i): RemoteNode => ({ type: 'quill-tag', props: { label: `tag ${i}` } })) : []),
    ]);

  ctx.onNavigate((next) => {
    path = next;
    draw();
  });
  ctx.frame.set({ title: 'Reference on the contract', actions: [{ command: 'check.again' }] });
  ctx.frame.onCommand('check.again', () => {
    commands++;
    draw();
  });
  draw();
});
