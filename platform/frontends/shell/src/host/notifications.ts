import type { ShellNotification } from '@platform/ui-kit';

let seq = 0;

/** Turns an app's ctx.notify() call into a notification on the Shell's stream. */
export function toShellNotification(
  app: string,
  message: { title: string; body?: string; needsYou?: boolean },
  now = Date.now(),
): ShellNotification {
  return {
    id: `${app}-${now}-${++seq}`,
    app,
    level: message.needsYou ? 'needs' : 'info',
    title: message.title,
    detail: message.body,
    time: now,
  };
}
