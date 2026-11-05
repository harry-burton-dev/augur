import type { InboxChange, NotificationAction } from '@augur/mfe-sdk';
import type { ShellNotification } from '@augur/shell-kit';
import { usableActions } from './notifications.js';

/** A notification as the events service sends it. */
export interface ServerNotification {
  id: string;
  app: string;
  level: 'needs' | 'info' | 'done' | 'failed';
  title: string;
  detail?: string;
  /** Path inside the app to open. */
  link?: string;
  createdAt: string;
  /** The floor it's from, with its path from the root. */
  workspace?: { id: string; path: string[] };
  /** Up to two buttons, each an intent the shell raises when pressed. */
  actions?: NotificationAction[];
}

export const fromServer = (n: ServerNotification): ShellNotification => {
  const actions = usableActions(n.actions).map(({ label }) => ({ label }));
  return {
    id: n.id,
    app: n.app,
    level: n.level,
    title: n.title,
    detail: n.detail,
    time: n.createdAt,
    ...(n.workspace ? { floor: n.workspace.id } : {}),
    ...(actions.length ? { actions } : {}),
  };
};

export interface FeedOptions {
  getToken(): Promise<string>;
  /** Everything unread, on start and again after each reconnect, so nothing missed while offline is lost. */
  onList(list: ServerNotification[]): void;
  onNotification(n: ServerNotification): void;
  /**
   * An inbox item the person can see changed (`event: inbox` on the same stream), or, with nothing,
   * the stream (re)connected and anything may have changed while it was away: load the Inbox again.
   */
  onInbox?(change?: InboxChange): void;
  /** Whether the stream is working, in words the Shell can show. */
  onState(state: { loading: boolean; error: string }): void;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  retryMs?: number;
  maxRetryMs?: number;
}

/** Splits a server-sent-events body into its events of one name: notifications unless asked for another. */
export function parseEvents<T = ServerNotification>(buffer: string, name = 'notification'): { events: T[]; rest: string } {
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: T[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (!lines.includes(`event: ${name}`)) continue;
    const data = lines
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6))
      .join('\n');
    try {
      events.push(JSON.parse(data) as T);
    } catch {
      // A malformed event is skipped; the next list load corrects anything missed.
    }
  }
  return { events, rest };
}

/**
 * The person's notifications from the events service: the unread list, then a
 * live stream that reconnects with growing pauses when it drops. EventSource
 * can't send the sign-in token, so the stream is read with fetch.
 */
export class NotificationFeed {
  private controller?: AbortController;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly opts: FeedOptions) {
    // Called unbound: the browser's fetch throws "Illegal invocation" when called as a method of another object.
    const fetchImpl = opts.fetchImpl ?? fetch;
    this.fetchImpl = (...args) => fetchImpl(...args);
    this.baseUrl = opts.baseUrl ?? '/api/events/v1';
  }

  private async headers() {
    return { authorization: `Bearer ${await this.opts.getToken()}`, accept: 'application/json' };
  }

  async load(): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/notifications`, { headers: await this.headers() });
    if (!res.ok) throw new Error(`answered ${res.status}`);
    this.opts.onList((await res.json()) as ServerNotification[]);
  }

  /** Marks a notification read (or unread again after Undo). Failures are quiet: the worst case is it shows again next time. */
  async setRead(id: string, read: boolean): Promise<void> {
    await this.fetchImpl(`${this.baseUrl}/notifications/${encodeURIComponent(id)}/read`, { method: read ? 'POST' : 'DELETE', headers: await this.headers() }).catch(() => undefined);
  }

  start(): void {
    this.stop();
    const controller = (this.controller = new AbortController());
    void this.run(controller.signal);
  }

  stop(): void {
    this.controller?.abort();
    this.controller = undefined;
  }

  private async run(signal: AbortSignal) {
    const { retryMs = 1000, maxRetryMs = 30_000 } = this.opts;
    let pause = retryMs;
    this.opts.onState({ loading: true, error: '' });
    while (!signal.aborted) {
      try {
        await this.load();
        const res = await this.fetchImpl(`${this.baseUrl}/notifications/stream`, { headers: await this.headers(), signal });
        if (!res.ok || !res.body) throw new Error(`answered ${res.status}`);
        this.opts.onState({ loading: false, error: '' });
        this.opts.onInbox?.();
        pause = retryMs;
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = buffer + value;
          const parsed = parseEvents(text);
          buffer = parsed.rest;
          parsed.events.forEach((n) => this.opts.onNotification(n));
          parseEvents<InboxChange>(text, 'inbox').events.forEach((c) => this.opts.onInbox?.(c));
        }
      } catch {
        if (signal.aborted) return;
        this.opts.onState({ loading: false, error: "Notifications aren't arriving right now. Trying again…" });
      }
      if (signal.aborted) return;
      await new Promise((r) => setTimeout(r, pause));
      pause = Math.min(pause * 2, maxRetryMs);
    }
  }
}
