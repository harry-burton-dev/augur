import type { Intent, NotificationAction, NotifyMessage } from '@augur/mfe-sdk';
import type { ShellNotification } from '@augur/ui-kit';

let seq = 0;

/** How many buttons a notification may carry; extras are dropped. */
export const MAX_ACTIONS = 2;

/** Turns an app's ctx.notify() call into a notification on the Shell's stream. */
export function toShellNotification(app: string, message: NotifyMessage, now = Date.now()): ShellNotification {
  const actions = usableActions(message.actions).map(({ label }) => ({ label }));
  return {
    id: `${app}-${now}-${++seq}`,
    app,
    level: message.needsYou ? 'needs' : 'info',
    title: message.title,
    detail: message.body,
    time: now,
    ...(actions?.length ? { actions } : {}),
  };
}

/** Only well-formed actions reach the stream: an app's mistake shows no button rather than a broken one. */
export const usableActions = (actions: unknown): NotificationAction[] =>
  (Array.isArray(actions) ? actions : [])
    .filter((a): a is NotificationAction => !!a && typeof a.label === 'string' && !!a.label && typeof a.intent?.type === 'string')
    .slice(0, MAX_ACTIONS);

/**
 * The intents behind the buttons on the stream. The Shell only knows a
 * button's label; pressing it comes back here by notification and index, so
 * no app code ever runs in the stream.
 */
export class NotificationActions {
  private readonly byId = new Map<string, NotificationAction[]>();

  remember(id: string, actions: unknown) {
    const usable = usableActions(actions);
    if (usable.length) this.byId.set(id, usable);
  }

  forget(id: string) {
    this.byId.delete(id);
  }

  /** The intent the button at `index` raises, with an empty payload when the app sent none. */
  intentFor(id: string, index: number): Intent | undefined {
    const action = this.byId.get(id)?.[index];
    return action && { type: action.intent.type, payload: action.intent.payload ?? {} };
  }
}
