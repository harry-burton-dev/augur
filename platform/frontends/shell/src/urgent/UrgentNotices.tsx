import { Button, Explain, Letterbox, UrgentEdge, type LetterboxAcknowledgement } from '@augur/shell-kit';
import { useEffect, useState } from 'react';
import type { ServerNotification } from '../host/index.js';
import { dateTimeFormat } from '../host/formats.js';

/** The Upgrade Centre's preview that letterboxes urgent news (PER-283, ADR 0044 D3). */
export const URGENT_PREVIEW = 'urgent-letterbox';

/**
 * The urgent notifications the shell letterboxes, oldest first: unread, marked urgent by a platform
 * service, and from an app whose `urgent-letterbox` preview is on for the person. The rest stay on
 * the stream as they always have.
 */
export const urgentQueue = (unread: readonly ServerNotification[], previewOn: (app: string) => boolean): ServerNotification[] =>
  unread.filter((n) => n.urgent && previewOn(n.app)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

export interface UrgentNoticesProps {
  /** From `urgentQueue`: the first is shown, the rest wait behind it. */
  queue: readonly ServerNotification[];
  /** The app's name, as the catalogue gives it. */
  appName: (app: string) => string;
  /** The floor's name, when the notification is from one. */
  floorName?: (id: string) => string | undefined;
  /** The person, as acknowledgements name them. */
  me: string;
  /** Opens it where it can be dealt with, and marks it read. */
  onOpen: (id: string) => void;
}

/**
 * Urgent is letterboxed (PDR-009): the first urgent notification opens over the work, see-through,
 * with the rest in its queue. Esc steps it back to the edge rule, where it stays until it's opened;
 * nothing dismisses it. Acknowledging says "I've seen it" and is not resolving it; it is kept in
 * this tab only, until the events service records who has seen what.
 */
export function UrgentNotices({ queue, appName, floorName, me, onOpen }: UrgentNoticesProps) {
  const first = queue[0];
  const [open, setOpen] = useState(true);
  const [acknowledged, setAcknowledged] = useState<Record<string, LetterboxAcknowledgement>>({});
  // A new item at the front opens again, even if the last one was stepped back.
  useEffect(() => {
    if (first) setOpen(true);
  }, [first?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!first) return null;
  const app = appName(first.app);
  const floor = first.workspace ? floorName?.(first.workspace.id) : undefined;
  const place = { position: 1, total: queue.length, ...(queue[1] ? { next: queue[1].title } : {}) };
  const ack = acknowledged[first.id];
  return (
    <>
      {open ? null : <UrgentEdge headline={first.title} acknowledged={!!ack} queue={place} onReopen={() => setOpen(true)} />}
      <Letterbox
        open={open}
        look="see-through"
        onStepBack={() => setOpen(false)}
        acknowledged={ack}
        onAcknowledge={() => setAcknowledged((was) => ({ ...was, [first.id]: { by: me, at: dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(new Date()) } }))}
        queue={place}
        bars={{
          top: <span>{[app, floor].filter(Boolean).join(' · ')}</span>,
          bottom: <span>It stays until someone opens it.</span>,
        }}
        eyebrow={app}
        heading={first.title}
        summary={first.detail}
        actions={
          <Button kind="primary" onPress={() => onOpen(first.id)}>
            Open in {app}
          </Button>
        }
      >
        <Explain
          what={first.detail ?? first.title}
          why="It stops work on this server until someone acts on it."
          canDo={`Open it in ${app} to see the steps and choose what to do.`}
          whoElse="Everyone else it was sent to was told at the same time."
        />
      </Letterbox>
    </>
  );
}
