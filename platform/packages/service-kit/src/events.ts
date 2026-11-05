import { callService, type ServiceCredentials } from './service.js';

export type NotificationLevel = 'needs' | 'info' | 'done' | 'failed';

export interface NewNotification {
  /** The app it is about; the Shell opens this app when the person opens the notification. */
  app: string;
  /** User ids of the people to tell. Empty with `toTeam` or `audience`. */
  recipients: string[];
  /**
   * Platform services only (ADR 0044): who to tell as principals, worked out
   * by identity as it's sent, such as `role:deployment-admin`. Instead of
   * `recipients`.
   */
  audience?: string[];
  /**
   * The sender's own name for this news, such as "available:augur:0.15.0".
   * A person is told it once: a second notification with the same app and
   * key is not added for anyone who already has one, read or not.
   */
  key?: string;
  /**
   * One of the kinds the app's manifest declares (`notifications.kinds`), so each person can
   * choose in Account how this kind reaches them. One the manifest doesn't declare is refused.
   */
  kind?: string;
  /**
   * Tells everyone on the team the call's floor names, instead of
   * `recipients`. Only on a team that has turned team notices on; who is on
   * it is checked as it's sent.
   */
  toTeam?: boolean;
  /** "needs" when the person has to do something. */
  level: NotificationLevel;
  title: string;
  detail?: string;
  /** Path inside the app to open, e.g. "/doc/123". */
  link?: string;
  /**
   * Up to two buttons on it in the Shell ("Approve", "Open"). Pressing one
   * raises its intent in the person's browser, through the shell, exactly as
   * an app's `ctx.raise` would, and marks the notification read.
   */
  actions?: NotificationAction[];
}

export interface NotificationAction {
  /** One or two words, at most 30 characters. */
  label: string;
  /** An intent type some app `handles`, and its payload: at most 1 KB as JSON. */
  intent: { type: string; payload?: unknown };
}

export interface NewAuditEntry {
  /** Who did it: a person's id, or a service's name. */
  actor: { id: string; kind: 'user' | 'service' };
  /** The app or service it happened in. */
  app: string;
  /** What happened, as a dotted verb: "app.registered", "document.published". */
  action: string;
  /** What it happened to, e.g. a document id. */
  target?: string;
  detail?: Record<string, unknown>;
}

interface EventsOptions {
  /** The events service's internal address, e.g. http://events:8084. */
  eventsUrl: string;
  credentials: ServiceCredentials;
  /** The floor it happened on; an app's grants are checked there. */
  workspace?: string;
  fetchImpl?: typeof fetch;
  /** Where APP_PREVIEW is read from: set by the app runner on a pull request's preview. */
  env?: Record<string, string | undefined>;
}

/** The pull request this service is a preview of (APP_PREVIEW=pr-12 → 12), or undefined for the app itself. */
export const previewOf = (env: Record<string, string | undefined> = process.env) => {
  const m = /^pr-(\d+)$/.exec(env.APP_PREVIEW ?? '');
  return m ? Number(m[1]) : undefined;
};

/** Tells people something through the Shell's stream. A preview's notifications say they're from it. */
export async function notify({ eventsUrl, credentials, workspace, fetchImpl, notification, env }: EventsOptions & { notification: NewNotification }): Promise<void> {
  const pr = previewOf(env);
  await callService({
    method: 'POST',
    url: `${eventsUrl.replace(/\/$/, '')}/v1/notifications`,
    credentials,
    body: pr === undefined ? notification : { ...notification, title: `Preview #${pr}: ${notification.title}`.slice(0, 200) },
    what: notification.toTeam ? 'notify the team' : notification.audience?.length ? `notify ${notification.audience.join(', ')}` : `notify ${notification.recipients.length} people`,
    workspace,
    attempts: 3,
    fetchImpl,
  });
}

/** Adds an entry to the platform's audit log. A preview's entries say which pull request they're from. */
export async function recordAudit({ eventsUrl, credentials, workspace, fetchImpl, entry, env }: EventsOptions & { entry: NewAuditEntry }): Promise<void> {
  const pr = previewOf(env);
  await callService({
    method: 'POST',
    url: `${eventsUrl.replace(/\/$/, '')}/v1/audit`,
    credentials,
    body: pr === undefined ? entry : { ...entry, detail: { ...entry.detail, preview: pr } },
    what: `record ${entry.action} in the audit log`,
    workspace,
    attempts: 3,
    fetchImpl,
  });
}
