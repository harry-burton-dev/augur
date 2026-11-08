/**
 * The reference app, on the app contract (contract 3): it runs in the shell's worker and draws only
 * Quill's remote vocabulary. It uses every part of the app context the SDK promises, and its manifest
 * every contribution the shell draws for it. Each check is a notice whose heading names it and whose
 * text is what it found, for the specs in tests/ to read; each button is something a test presses.
 */
import { defineApp, type AppContext, type RemoteNode } from '@augur/mfe-sdk/sdk3';

const check = (name: string, found: string): RemoteNode => ({ type: 'quill-notice', props: { heading: `check ${name}` }, children: found });
const button = (label: string, onPress: () => void): RemoteNode => ({ type: 'quill-button', props: { label, onPress } });

/** The feature previews the manifest declares, and one it doesn't: the contract tests turn the first on for the stand-in person (DEV_PREVIEWS). */
const PREVIEWS = ['turned-on', 'left-off', 'not-declared'];

export default defineApp((ctx: AppContext) => {
  const scope = globalThis as Record<string, unknown>;
  const network = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'indexedDB', 'caches', 'BroadcastChannel', 'Worker'].filter((name) => typeof scope[name] !== 'undefined');
  const tokenish = Object.keys(scope).filter((k) => /token/i.test(k));
  let path = ctx.path;
  let fetched = 'not yet';
  let answer = 'not asked';
  let flood = false;
  let commands = 0;
  let policy = 'not tried';
  // The worker's own Content-Security-Policy says what it may load: scripts from the shell's origin, nothing else.
  (globalThis as unknown as EventTarget).addEventListener('securitypolicyviolation', (e) => {
    policy = `held: ${(e as SecurityPolicyViolationEvent).effectiveDirective}`;
    draw();
  });

  const intent = ctx.intent ? `${ctx.intent.type} ${JSON.stringify(ctx.intent.payload)}` : 'none';

  const ask = () =>
    ctx.request<{ answer: number }>({ type: 'reference.answer', payload: { question: 'six times seven' } }).then(
      (result) => {
        answer = String(result.answer);
        draw();
      },
      (err: Error) => {
        answer = err.name === 'IntentCancelled' ? 'cancelled' : `failed: ${err.message}`;
        draw();
      },
    );

  // Opened to answer a request: the question, and the two ways to answer it.
  const answering = (reply: NonNullable<AppContext['reply']>): RemoteNode[] => [
    check('intent', intent),
    button('Answer 42', () => reply.respond({ answer: 42 })),
    button('Decline', () => reply.cancel()),
  ];

  const working = (): RemoteNode[] => [
    check('person', `${ctx.person.name} (${ctx.person.id})`),
    check('floor', `${ctx.workspace.name} (${ctx.workspace.id}, ${ctx.workspace.kind})`),
    check('path', path),
    check('intent', intent),
    // The worker has remote-dom's DOM, never the shell's page: none of its storage or cookies.
    check(
      'worker',
      `network: ${network.join(',') || 'none'}; document: ${typeof (scope.document as { createElement?: unknown })?.createElement}; page: ${['localStorage', 'sessionStorage', 'cookieStore'].filter((k) => typeof scope[k] !== 'undefined').join(',') || 'none'}; token: ${tokenish.join(',') || 'none'}`,
    ),
    check('previews', PREVIEWS.map((id) => `${id}:${ctx.previewOn(id) ? 'on' : 'off'}`).join(' ')),
    check('fetched', fetched),
    check('answer', answer),
    check('commands', String(commands)),
    check('policy', policy),
    // Not in Quill's remote vocabulary: the host drops it, with a reason on the console.
    { type: 'evil-frame', props: { src: 'https://example.org/' } },
    button('Notify', () => ctx.notify({ title: 'Reference notification', body: 'From the reference app', needsYou: true })),
    button('Raise', () => void ctx.raise({ type: 'reference.show', payload: { n: 1 } })),
    button('Request', () => void ask()),
    button('Fetch', () => {
      void ctx.fetch('/api/reference/v1/echo', { headers: { authorization: 'Bearer forged', 'x-augur-app': 'someone-else', 'x-workspace-id': 'someone-elses-floor' } }).then(
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
      const elsewhere: string = 'https://example.org/module.js';
      void import(/* @vite-ignore */ elsewhere).catch(() => undefined);
    }),
    button('Go to claims', () => ctx.navigate('/claims/7')),
    button('Climb out', () => ctx.navigate('/../admin')),
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
  ];

  const draw = () => ctx.frame.screen.render(ctx.reply ? answering(ctx.reply) : working());

  ctx.onNavigate((next) => {
    path = next;
    draw();
  });
  ctx.frame.set({ title: 'Reference on the contract', actions: [{ command: 'check.again' }] });
  ctx.frame.onCommand('check.again', () => {
    commands++;
    draw();
  });
  // The Home card (contributes.card): drawn by the same worker, on the floor it runs on.
  ctx.frame.card.render([check('card', `Reference card on ${ctx.workspace.id}`), button('Show', () => void ctx.raise({ type: 'reference.show', payload: { n: 3 } }))]);
  draw();
});
