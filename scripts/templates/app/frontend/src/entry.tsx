import { Button, Heading } from '@augur/app-kit';
import { defineMicroFrontend, type MountContext } from '@augur/mfe-sdk';
import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/** Asks the app's own service, through the gateway, as the person on this floor. */
const greeting = async (ctx: MountContext) => {
  const res = await ctx.fetch('/api/__ID__/v1/greeting');
  if (!res.ok) throw new Error(String(res.status));
  return ((await res.json()) as { message: string }).message;
};

/** __NAME__'s one page: who you are to its service, and a notification through the shell. */
export function App({ ctx }: { ctx: MountContext }) {
  const [summary, setSummary] = useState('Asking the service…');
  useEffect(() => {
    let live = true;
    greeting(ctx).then(
      (message) => live && setSummary(message),
      () => live && setSummary("The app's service isn't answering. Is it running?"),
    );
    return () => {
      live = false;
    };
  }, [ctx]);
  return (
    <div style={{ maxWidth: 'var(--measure-read)', margin: '0 auto', padding: 'var(--space-7) var(--edge)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Heading eyebrow="__NAME__" heading={`Hello, ${ctx.user.name.split(' ')[0]}`} summary={summary} level={1} />
      <div>
        <Button kind="secondary" onPress={() => ctx.notify({ title: 'Hello from __NAME__' })}>
          Send a notification
        </Button>
      </div>
    </div>
  );
}

const roots = new WeakMap<HTMLElement, Root>();

/** __NAME__: what the shell mounts at /__ID__. React and Quill come from the shell, through its import map. */
export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    const root = createRoot(el);
    roots.set(el, root);
    root.render(<App ctx={ctx} />);
  },
  unmount(el: HTMLElement) {
    roots.get(el)?.unmount();
    roots.delete(el);
  },
});
