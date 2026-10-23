import { callService, type ServiceCredentials } from './service.js';

export type NotificationLevel = 'needs' | 'info' | 'done' | 'failed';

export interface NewNotification {
  /** The app it is about; the Shell opens this app when the person opens the notification. */
  app: string;
  /** User ids of the people to tell. Empty with `toTeam`. */
  recipients: string[];
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
}

/** Tells people something through the Shell's stream. */
export async function notify({ eventsUrl, credentials, workspace, fetchImpl, notification }: EventsOptions & { notification: NewNotification }): Promise<void> {
  await callService({
    method: 'POST',
    url: `${eventsUrl.replace(/\/$/, '')}/v1/notifications`,
    credentials,
    body: notification,
    what: notification.toTeam ? 'notify the team' : `notify ${notification.recipients.length} people`,
    workspace,
    attempts: 3,
    fetchImpl,
  });
}

/** Adds an entry to the platform's audit log. */
export async function recordAudit({ eventsUrl, credentials, workspace, fetchImpl, entry }: EventsOptions & { entry: NewAuditEntry }): Promise<void> {
  await callService({
    method: 'POST',
    url: `${eventsUrl.replace(/\/$/, '')}/v1/audit`,
    credentials,
    body: entry,
    what: `record ${entry.action} in the audit log`,
    workspace,
    attempts: 3,
    fetchImpl,
  });
}
