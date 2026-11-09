/**
 * Pushes domain events to the apps that subscribe (contract 3, spec 8.6). For each app the registry says holds
 * `events:subscribe`, the events it hasn't had yet go to its inbound part through the gateway, one at a time
 * and in order, as `POST /api/<id>/augur/events` with the events service's own token (the gateway signs a caller
 * naming the service) and an idempotency key that is the same on every attempt. A part that answers anything
 * but 2xx, or doesn't answer, is tried again with growing waits for up to a day, then that event is passed over
 * and the passing recorded in Activity. An app that has taken nothing for an hour is stalled, which Admin → Apps
 * shows with the reason. An event on a floor where the app is off, or the app's own events, aren't sent to it.
 */
import { eventDeliveryKey, GrantsUnavailable, IDEMPOTENCY_KEY_HEADER, PART_EVENTS_PATH, serviceHeaders, withDeadline, type GrantedApp, type GrantLookup, type NewAuditEntry, type ServiceCredentials } from '@augur/service-kit';
import type { DomainEvent, EventStore } from './store.ts';
import type { Delivery, Outcome } from './deliveries.ts';

/** How long a part may fail before the event it can't take is passed over (spec 8.6: a day). */
export const GIVE_UP_AFTER_MS = 24 * 3_600_000;
/** How long an app may take nothing before Admin shows it stalled (spec 8.6: an hour). */
export const STALLED_AFTER_MS = 3_600_000;
/** The longest wait between attempts. */
export const MAX_BACKOFF_MS = 10 * 60_000;
/** How long one instance holds an app while delivering to it; renewed with every event, released at the end. */
export const LEASE_SECONDS = 60;

/** The wait before attempt `failures + 1`: a second, doubling, up to MAX_BACKOFF_MS. */
export const backoffMs = (failures: number): number => Math.min(1000 * 2 ** Math.max(0, failures - 1), MAX_BACKOFF_MS);

export type SendResult = { ok: true } | { ok: false; reason: string };
/** Sends one event to an app's part; says in words why it didn't get through. Never throws. */
export type SendEvent = (app: string, event: DomainEvent) => Promise<SendResult>;

export interface SendOptions {
  /** The gateway, which every call to a part goes through (GATEWAY_URL). */
  gatewayUrl: string;
  credentials: ServiceCredentials;
  fetchImpl?: typeof fetch;
}

/** Sends events to parts through the gateway as the events service itself. */
export const sendThroughGateway = ({ gatewayUrl, credentials, fetchImpl = fetch }: SendOptions): SendEvent => {
  const base = gatewayUrl.replace(/\/+$/, '');
  return async (app, event) => {
    let res: Response;
    try {
      res = await withDeadline(fetchImpl)(`${base}/api/${encodeURIComponent(app)}${PART_EVENTS_PATH}`, {
        method: 'POST',
        headers: { ...(await serviceHeaders(credentials)), 'content-type': 'application/json', [IDEMPOTENCY_KEY_HEADER]: eventDeliveryKey(event) },
        body: JSON.stringify(event),
      });
    } catch (err) {
      return { ok: false, reason: `${app}’s part couldn’t be reached: ${(err as Error).message}` };
    }
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, reason: `${app}’s part answered ${res.status}${body.message ? `: ${body.message}` : ''}` };
  };
};

export interface DelivererOptions {
  store: EventStore;
  /** The apps that subscribe: those the registry says hold events:subscribe, on or turned off. */
  subscribers: () => Promise<GrantedApp[]>;
  /** What an app holds on a floor; an event on a floor where it lacks events:subscribe isn't sent there. */
  grants: GrantLookup;
  send: SendEvent;
  /** Records an event passed over after a day of failures, and an app's place forgotten; `key` makes a repeat harmless. */
  audit?: (entry: NewAuditEntry, key: string) => Promise<void>;
  /** How long one instance drives an app before another may take over, should it die mid-pass. */
  leaseSeconds?: number;
  now?: () => number;
  /** How many events are read at once per app. */
  batch?: number;
  log?: { info(obj: object, msg: string): void; warn(obj: object, msg: string): void; error(obj: object, msg: string): void };
}

export interface DeliveryReport {
  /** Events that got through, over every app. */
  delivered: number;
  /** Events passed over: the app's own, or on a floor where it is off. */
  skipped: number;
  /** Apps whose part refused or couldn't be reached this pass. */
  failed: string[];
  /** Events given up on after a day. */
  dropped: number;
}

/** What a person reads about an app's deliveries in Admin → Apps; `since` is when the trouble began, for Admin to put a date to. */
export const deliveryStatus = (d: Delivery, now = Date.now()): { state: 'ok' | 'retrying' | 'stalled'; words: string } => {
  if (!d.failingSince) {
    const dropped = d.dropped ? ` ${d.dropped} ${d.dropped === 1 ? 'event was' : 'events were'} passed over after a day of failures.` : '';
    return { state: 'ok', words: (d.deliveredAt ? 'Taking events.' : 'Nothing to deliver yet.') + dropped };
  }
  const since = new Date(d.failingSince).getTime();
  const stalled = now - since >= STALLED_AFTER_MS;
  const reason = d.lastError ?? 'the part didn’t answer';
  return { state: stalled ? 'stalled' : 'retrying', words: `${stalled ? 'Not taking events' : 'Retrying'}: ${reason}.` };
};

/** Why nothing is being pushed to parts right now, when that is so; Admin shows it beside each subscribing app. */
export type PushingState = { on: true; problem?: string } | { on: false; why: string; whoCanChange: string };

const SERVICE_ACTOR = { id: 'events', kind: 'service' as const };

/** Delivers to every subscribing app that is due; one pass at a time. */
export const eventDeliverer = ({ store, subscribers, grants, send, audit, now = Date.now, batch = 100, leaseSeconds = LEASE_SECONDS, log }: DelivererOptions) => {
  let running: Promise<DeliveryReport> | undefined;
  let again = false;
  /** What stopped the last pass, if anything: the registry or the database not answering. */
  let problem: string | undefined;

  const move = async (app: string, row: Delivery, to: string, outcome: Outcome): Promise<Delivery | undefined> => {
    // Another instance got here first: its cursor stands.
    if (!(await store.deliveries.advance(app, row.cursor, to, outcome))) return undefined;
    return { ...row, cursor: to, failures: 0, failingSince: null, lastError: null, nextAt: null };
  };

  const deliverTo = async (app: string, enabled: boolean, report: DeliveryReport) => {
    let row = await store.deliveries.ensure(app);
    // A turned-off app keeps its place: what it missed waits for it to be turned on again.
    if (!enabled) return;
    if (row.nextAt && new Date(row.nextAt).getTime() > now()) return;
    if (!(await store.deliveries.claim(app, leaseSeconds))) return;
    try {
      for (;;) {
        const events = await store.readEvents({ topics: ['*'], after: row.cursor, limit: batch });
        if (events.length === 0) return;
        for (const event of events) {
          let wanted = event.publisher !== app;
          if (wanted) {
            try {
              wanted = (await grants(app, event.workspace?.id)).includes('events:subscribe');
            } catch (err) {
              if (!(err instanceof GrantsUnavailable)) throw err;
              log?.warn({ app, err: err.message }, 'could not check where an app subscribes; trying again later');
              problem = `The registry can’t be asked where apps subscribe (${err.message}).`;
              return;
            }
          }
          const sent = wanted ? await send(app, event) : undefined;
          if (sent && !sent.ok) {
            const since = row.failingSince ? new Date(row.failingSince).getTime() : now();
            if (now() - since >= GIVE_UP_AFTER_MS) {
              // A day of failing: this event is passed over so the ones behind it can go, and the passing is recorded once.
              const moved = await move(app, row, event.seq, 'dropped');
              if (!moved) return;
              row = moved;
              report.dropped++;
              log?.error({ app, seq: event.seq, reason: sent.reason }, 'event passed over after a day of failed deliveries');
              await audit?.({ actor: SERVICE_ACTOR, app: 'events', action: 'delivery.dropped', target: app, detail: { seq: event.seq, topic: event.topic, reason: sent.reason } }, `delivery.dropped:${app}:${event.seq}`);
              continue;
            }
            const nextAt = new Date(now() + backoffMs(row.failures + 1));
            // Recorded only against the event that failed: if another instance has moved on, the row is healthy and stays so.
            if (await store.deliveries.failed(app, row.cursor, sent.reason, nextAt, new Date(since))) {
              report.failed.push(app);
              log?.warn({ app, seq: event.seq, reason: sent.reason, nextAt }, 'event delivery failed');
            }
            return;
          }
          const moved = await move(app, row, event.seq, sent ? 'sent' : 'skipped');
          if (!moved) return;
          row = moved;
          if (sent) report.delivered++;
          else report.skipped++;
          // The lease is held for as long as events keep going through.
          await store.deliveries.claim(app, leaseSeconds).catch(() => false);
        }
        if (events.length < batch) return;
      }
    } finally {
      await store.deliveries.release(app).catch((err: unknown) => log?.warn({ app, err: String(err) }, 'could not give back an app’s delivery lease; it lapses by itself'));
    }
  };

  const pass = async (): Promise<DeliveryReport> => {
    const report: DeliveryReport = { delivered: 0, skipped: 0, failed: [], dropped: 0 };
    let apps: GrantedApp[];
    try {
      apps = await subscribers();
    } catch (err) {
      if (!(err instanceof GrantsUnavailable)) throw err;
      problem = `The registry can’t be asked which apps subscribe (${err.message}).`;
      log?.warn({ err: err.message }, 'could not list the apps that subscribe to events; trying again later');
      return report;
    }
    problem = undefined;
    const known = new Set(apps.map((a) => a.app));
    for (const row of await store.deliveries.list()) {
      if (known.has(row.app)) continue;
      // The grant is gone (not merely the app turned off): its place goes too, and the going is recorded.
      await store.deliveries.forget(row.app);
      await audit?.({ actor: SERVICE_ACTOR, app: 'events', action: 'delivery.forgotten', target: row.app, detail: { cursor: row.cursor } }, `delivery.forgotten:${row.app}:${row.cursor}`);
    }
    await Promise.all(
      apps.map((a) =>
        deliverTo(a.app, a.enabled, report).catch((err: unknown) => {
          log?.error({ app: a.app, err: String(err) }, 'delivering events failed');
        }),
      ),
    );
    return report;
  };

  const tick = (): Promise<DeliveryReport> => {
    if (running) {
      again = true;
      return running;
    }
    running = pass()
      .catch((err: unknown) => {
        // Never an unhandled rejection: a pass that can't run (the database away) waits for the next.
        problem = `Deliveries couldn’t be looked at (${err instanceof Error ? err.message : String(err)}).`;
        log?.error({ err: String(err) }, 'delivery pass failed');
        return { delivered: 0, skipped: 0, failed: [], dropped: 0 };
      })
      .finally(() => {
        running = undefined;
        if (again) {
          again = false;
          void tick();
        }
      });
    return running;
  };

  return {
    /** One pass over every subscribing app; a pass asked for while one runs follows it. */
    tick,
    /** What stopped the last pass, when something did. */
    get problem() {
      return problem;
    },
    /** Starts: a pass now, one each time an event is published, and one every `intervalMs` for retries and catch-up. */
    start(intervalMs = 15_000) {
      const stopEvents = store.onEvent(() => void tick());
      const timer = setInterval(() => void tick(), intervalMs);
      timer.unref();
      void tick();
      return () => {
        stopEvents();
        clearInterval(timer);
      };
    },
  };
};
