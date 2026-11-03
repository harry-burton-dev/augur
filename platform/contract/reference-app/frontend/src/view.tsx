import { Button, Heading } from '@augur/app-kit';
import { isIntentCancelled, openDocument, pickDocument, type MountContext, type WorkspaceRef } from '@augur/mfe-sdk';
import { useEffect, useState, version } from 'react';

/** The feature previews the manifest declares: run.mjs turns the first on for the stand-in person (DEV_PREVIEWS). */
const PREVIEWS = ['turned-on', 'left-off', 'not-declared'];

/** A floor as the check shows it: its slug, and the name of its level where it has one (teams only, SDK 1.9). */
const floorLevel = (f: WorkspaceRef) => (f.level ? `${f.slug}:${f.level}` : f.slug);

export function Reference({ ctx }: { ctx: MountContext }) {
  const [token, setToken] = useState('waiting');
  const [answer, setAnswer] = useState('');
  const [bus, setBus] = useState('');
  const [fetched, setFetched] = useState('');
  const [opened, setOpened] = useState('');
  const [picked, setPicked] = useState('');

  useEffect(() => ctx.bus.on<string>('reference.ping', setBus), [ctx]);
  useEffect(() => {
    void ctx.getToken().then((t) => setToken(typeof t === 'string' ? 'ok' : 'missing'));
  }, [ctx]);

  const ask = () =>
    ctx.request<{ answer: number }>({ type: 'reference.answer', payload: { question: 'six times seven' } }).then(
      (result) => setAnswer(String(result.answer)),
      (err: unknown) => setAnswer(isIntentCancelled(err) ? 'cancelled' : 'failed'),
    );
  const fetchFloor = async () => {
    const res = await ctx.fetch('/api/reference/v1/floor');
    setFetched(await res.text());
  };
  // SDK 1.4: the standard document intents, answered by whichever app handles them (Folio ships with AUGUR).
  const openOne = () =>
    openDocument(ctx, { app: 'folio', id: 'd-contract', title: 'Contract document' }).then(
      () => setOpened('raised'),
      () => setOpened('no app'),
    );
  const pickOne = () =>
    pickDocument(ctx, { purpose: 'For the contract tests' }).then(
      (ref) => setPicked(ref.title ?? ref.id),
      (err: unknown) => setPicked(isIntentCancelled(err) ? 'cancelled' : 'no app'),
    );

  const { workspace } = ctx;
  return (
    <section data-reference style={{ padding: 'var(--space-6)' }}>
      <Heading heading="Reference" />
      <dl>
        <dt>User</dt>
        <dd data-check="user">{`${ctx.user.name} (${ctx.user.id}) ${ctx.user.departments.join(',')}`}</dd>
        <dt>Path</dt>
        <dd data-check="path">{ctx.path}</dd>
        <dt>Token</dt>
        <dd data-check="token">{token}</dd>
        <dt>Intent</dt>
        <dd data-check="intent">{ctx.intent ? `${ctx.intent.type} ${JSON.stringify(ctx.intent.payload)}` : 'none'}</dd>
        <dt>Answer</dt>
        <dd data-check="answer">{answer}</dd>
        <dt>Bus</dt>
        <dd data-check="bus">{bus}</dd>
        <dt>Floor</dt>
        <dd data-check="floor">{`${workspace.name} (${workspace.slug}, ${workspace.kind}, ${workspace.role}) ${ctx.getWorkspace().id}`}</dd>
        <dt>Level</dt>
        <dd data-check="level">{`${workspace.level ?? 'none'} ${workspace.path.map(floorLevel).join(' > ')}`}</dd>
        <dt>Fetched</dt>
        <dd data-check="fetched">{fetched}</dd>
        <dt>Opened</dt>
        <dd data-check="opened">{opened}</dd>
        <dt>Picked</dt>
        <dd data-check="picked">{picked}</dd>
        <dt>Focus</dt>
        <dd data-check="focus">{ctx.focus ? ctx.focus.label : 'none'}</dd>
        <dt>Previews</dt>
        <dd data-check="previews">{PREVIEWS.map((id) => `${id}:${ctx.previewOn(id) ? 'on' : 'off'}`).join(' ')}</dd>
        <dt>React</dt>
        <dd data-check="react">{version}</dd>
      </dl>
      {ctx.reply ? (
        <>
          <Button data-action="respond" onPress={() => ctx.reply!.respond({ answer: 42 })}>
            Answer 42
          </Button>
          <Button data-action="cancel" onPress={() => ctx.reply!.cancel()}>
            Decline
          </Button>
        </>
      ) : (
        <>
          <Button data-action="notify" onPress={() => ctx.notify({ title: 'Reference notification', body: 'From the reference app', needsYou: true })}>
            Notify
          </Button>
          <Button
            data-action="notify-action"
            onPress={() => ctx.notify({ title: 'Reference action', needsYou: true, actions: [{ label: 'Show', intent: { type: 'reference.show', payload: { n: 2 } } }] })}
          >
            Notify with an action
          </Button>
          <Button data-action="raise" onPress={() => void ctx.raise({ type: 'reference.show', payload: { n: 1 } })}>
            Raise
          </Button>
          <Button data-action="request" onPress={() => void ask()}>
            Request
          </Button>
          <Button data-action="fetch" onPress={() => void fetchFloor()}>
            Fetch
          </Button>
          <Button data-action="emit" onPress={() => ctx.bus.emit('reference.ping', 'pong')}>
            Emit
          </Button>
          <Button data-action="open-document" onPress={() => void openOne()}>
            Open a document
          </Button>
          <Button data-action="pick-document" onPress={() => void pickOne()}>
            Pick a document
          </Button>
        </>
      )}
    </section>
  );
}

/** SDK 1.2: the glance card Home places on the person's own floor. */
export function Glance({ ctx }: { ctx: MountContext }) {
  return (
    <>
      <p data-check="card">{`Reference card on ${ctx.workspace.slug}`}</p>
      <Button data-action="card-raise" onPress={() => void ctx.raise({ type: 'reference.show', payload: { n: 3 } })}>
        Show
      </Button>
    </>
  );
}
