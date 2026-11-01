import { defineMicroFrontend, isIntentCancelled, openDocument, pickDocument, type MountContext } from '@augur/mfe-sdk';
import { html, render } from 'lit';
import '@augur/ui-kit';

/**
 * Uses every part of the mount context the SDK promises, and shows what it got
 * in data-check elements for tests/contract.spec.ts to read. Builds of this app
 * from past SDK releases are kept in frozen/, and must keep working in today's shell.
 */
declare global {
  interface Window {
    referenceUnmounts?: number;
  }
}

const views = new WeakMap<HTMLElement, () => void>();

export default defineMicroFrontend({
  async mount(el: HTMLElement, ctx: MountContext) {
    const state = { token: 'waiting', answer: '', bus: '', fetched: '', opened: '', picked: '' };
    const off = ctx.bus.on<string>('reference.ping', (payload) => {
      state.bus = payload;
      draw();
    });
    const ask = () =>
      ctx.request<{ answer: number }>({ type: 'reference.answer', payload: { question: 'six times seven' } }).then(
        (result) => {
          state.answer = String(result.answer);
          draw();
        },
        (err: unknown) => {
          state.answer = isIntentCancelled(err) ? 'cancelled' : 'failed';
          draw();
        },
      );
    const fetchFloor = async () => {
      const res = await ctx.fetch('/api/reference/v1/floor');
      state.fetched = await res.text();
      draw();
    };
    // SDK 1.4: the standard document intents, answered by whichever app handles them (Folio ships with AUGUR).
    const openOne = () =>
      openDocument(ctx, { app: 'folio', id: 'd-contract', title: 'Contract document' }).then(
        () => {
          state.opened = 'raised';
          draw();
        },
        () => {
          state.opened = 'no app';
          draw();
        },
      );
    const pickOne = () =>
      pickDocument(ctx, { purpose: 'For the contract tests' }).then(
        (ref) => {
          state.picked = ref.title ?? ref.id;
          draw();
        },
        (err: unknown) => {
          state.picked = isIntentCancelled(err) ? 'cancelled' : 'no app';
          draw();
        },
      );
    const draw = () =>
      render(
        html`<section data-reference style="padding:var(--space-6)">
          <ui-heading heading="Reference"></ui-heading>
          <dl>
            <dt>User</dt><dd data-check="user">${ctx.user.name} (${ctx.user.id}) ${ctx.user.departments.join(',')}</dd>
            <dt>Path</dt><dd data-check="path">${ctx.path}</dd>
            <dt>Token</dt><dd data-check="token">${state.token}</dd>
            <dt>Intent</dt><dd data-check="intent">${ctx.intent ? `${ctx.intent.type} ${JSON.stringify(ctx.intent.payload)}` : 'none'}</dd>
            <dt>Answer</dt><dd data-check="answer">${state.answer}</dd>
            <dt>Bus</dt><dd data-check="bus">${state.bus}</dd>
            <dt>Floor</dt><dd data-check="floor">${ctx.workspace.name} (${ctx.workspace.slug}, ${ctx.workspace.kind}, ${ctx.workspace.role}) ${ctx.getWorkspace().id}</dd>
            <dt>Fetched</dt><dd data-check="fetched">${state.fetched}</dd>
            <dt>Opened</dt><dd data-check="opened">${state.opened}</dd>
            <dt>Picked</dt><dd data-check="picked">${state.picked}</dd>
            <dt>Focus</dt><dd data-check="focus">${ctx.focus ? ctx.focus.label : 'none'}</dd>
          </dl>
          ${ctx.reply
            ? html`<ui-button data-action="respond" @click=${() => ctx.reply!.respond({ answer: 42 })}>Answer 42</ui-button>
                <ui-button data-action="cancel" @click=${() => ctx.reply!.cancel()}>Decline</ui-button>`
            : html`<ui-button data-action="notify" @click=${() => ctx.notify({ title: 'Reference notification', body: 'From the reference app', needsYou: true })}>Notify</ui-button>
                <ui-button data-action="notify-action" @click=${() =>
                  ctx.notify({ title: 'Reference action', needsYou: true, actions: [{ label: 'Show', intent: { type: 'reference.show', payload: { n: 2 } } }] })}>Notify with an action</ui-button>
                <ui-button data-action="raise" @click=${() => void ctx.raise({ type: 'reference.show', payload: { n: 1 } })}>Raise</ui-button>
                <ui-button data-action="request" @click=${() => void ask()}>Request</ui-button>
                <ui-button data-action="fetch" @click=${() => void fetchFloor()}>Fetch</ui-button>
                <ui-button data-action="emit" @click=${() => ctx.bus.emit('reference.ping', 'pong')}>Emit</ui-button>
                <ui-button data-action="open-document" @click=${() => void openOne()}>Open a document</ui-button>
                <ui-button data-action="pick-document" @click=${() => void pickOne()}>Pick a document</ui-button>`}
        </section>`,
        el,
      );
    views.set(el, off);
    draw();
    state.token = typeof (await ctx.getToken()) === 'string' ? 'ok' : 'missing';
    draw();
  },
  unmount(el: HTMLElement) {
    views.get(el)?.();
    render(html``, el);
    window.referenceUnmounts = (window.referenceUnmounts ?? 0) + 1;
  },
  // SDK 1.2: a glance card, which Home places on the person's own floor.
  surfaces: {
    './Glance': {
      mount(el: HTMLElement, ctx: MountContext) {
        render(
          html`<p data-check="card">Reference card on ${ctx.workspace.slug}</p>
            <ui-button data-action="card-raise" @click=${() => void ctx.raise({ type: 'reference.show', payload: { n: 3 } })}>Show</ui-button>`,
          el,
        );
      },
      unmount(el: HTMLElement) {
        render(html``, el);
      },
    },
  },
});
