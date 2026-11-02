import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button, Letterbox, Person } from '@augur/kit-common';
import { AppUnavailable } from './app-unavailable.js';
import { Connection } from './connection.js';
import { Toasts, type ToastItem } from './toast.js';

function ToastDemo() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  return (
    <>
      <Button onPress={() => setToasts((t) => [...t, { id: String(Date.now()), text: 'Archived 3 records', action: { label: 'Undo', onPress: () => {} } }])}>Archive</Button>
      <Toasts toasts={toasts} onDone={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </>
  );
}

function LetterboxDemo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p style={{ color: 'var(--ink-muted)' }}>Everything else on the screen steps back while it’s open.</p>
      <Button onPress={() => setOpen(true)}>Show it</Button>
      <Letterbox
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Upgrade"
        heading="AUGUR went back to 0.13.0"
        summary="The upgrade to 0.14.0 failed its health watch after 4 minutes, so it went back by itself."
        actions={
          <>
            <Button kind="primary" onPress={() => setOpen(false)}>
              See what failed
            </Button>
            <Button kind="tertiary" onPress={() => setOpen(false)}>
              Later
            </Button>
          </>
        }
      >
        <p>Nothing was lost. Everyone is back on 0.13.0.</p>
      </Letterbox>
    </>
  );
}

const meta = { title: 'Aerie/Notices', component: ToastDemo } satisfies Meta<typeof ToastDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Toast: Story = {};
/** Urgent is letterboxed (PDR-009). This frame comes from Common, so apps get the same one. */
export const Urgent: Story = { render: () => <LetterboxDemo /> };
export const Unavailable: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <AppUnavailable app={{ name: 'Data Atlas', icon: 'atlas' }} state="limited" reason="It’s only on department floors. Move to a department’s floor to open it." who={<Person name="Lee Park" detail="Organisation admin, can change this" tone="org" />} />
      <AppUnavailable app={{ name: 'Mandate', icon: 'compass' }} state="failed" reason="Its files didn’t load from the server." onRetry={() => {}} />
    </div>
  ),
};
export const Offline: Story = { render: () => <Connection state="offline" /> };
export const SessionEnded: Story = { render: () => <Connection state="expired" onSignIn={() => {}} /> };
