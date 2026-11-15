/**
 * Pushes domain events to the apps that subscribe (contract 3, spec 8.6). For each app the registry says holds
 * `events:subscribe`, the events it hasn't had yet go to its inbound part through the gateway, one at a time
 * and in order, as `POST /api/<id>/augur/events` with the events service's own token (the gateway signs a caller
 * naming the service) and an idempotency key that is the same on every attempt.
 *
 * A part that is down (it doesn't answer, isn't there for AUGUR, or asks to wait; or a second event fails with a
 * server error before any gets through) holds every event for its app, tried again with growing waits for up to a
 * day; then the event in front is set aside. A part that answers anything else but 2xx can't take that one event:
 * it is held beside the line and tried a few more times (later events on its topic wait behind it, so a topic keeps
 * its order), then set aside, while events on other topics go on (PER-462). What is set aside is kept, recorded in Activity, and listed for admins. An app that has taken
 * nothing for an hour is stalled, which Admin → Apps shows with the reason. An event on a floor where the app is
 * off, or the app's own events, aren't sent to it.
 */
import { eventDeliveryKey, GrantsUnavailable, IDEMPOTENCY_KEY_HEADER, PART_EVENTS_PATH, serviceHeaders, withDeadline, type DeclaredEventsLookup, type GrantedApp, type GrantLookup, type NewAuditEntry, type ServiceCredentials } from '@augur/service-kit';
import { topicMatches, type DomainEvent, type EventStore } from './store.ts';
import { readable } from './event-types.ts';
import type { Delivery, HeldEvent, HoldHow, Outcome } from './deliveries.ts';

/** How long a part may be down before the event at the head of its line is set aside (spec 8.6: a day). */
export const GIVE_UP_AFTER_MS = 24 * 3_600_000;
/** How long an app may take nothing before Admin shows it stalled (spec 8.6: an hour). */
export const STALLED_AFTER_MS = 3_600_000;
/** The longest wait between attempts. */
export const MAX_BACKOFF_MS = 10 * 60_000;
/** How long one instance holds an app while delivering to it; renewed with every event, released at the end. */
export const LEASE_SECONDS = 60;

/** How many times an event its part can't take is tried before it is set aside (DOMAIN_EVENTS_DELIVERY_ATTEMPTS). */
export const DELIVERY_ATTEMPTS = 5;
/** The wait before such an event's second try, doubling for each after, up to MAX_BACKOFF_MS (DOMAIN_EVENTS_RETRY_SECONDS). */
export const RETRY_MS = 30_000;

/** The wait before attempt `failures + 1` while a part is down: a second, doubling, up to MAX_BACKOFF_MS. */
export const backoffMs = (failures: number): number => Math.min(1000 * 2 ** Math.max(0, failures - 1), MAX_BACKOFF_MS);

/** The wait before try `failures + 1` of one event its part can't take: `retryMs`, doubling, up to MAX_BACKOFF_MS. */
export const retryBackoffMs = (failures: number, retryMs: number): number => Math.min(retryMs * 2 ** Math.max(0, failures - 1), MAX_BACKOFF_MS);

/**
 * `down`: the part didn't answer, isn't there for AUGUR (401, 403, 404), or said to wait (408, 429, 502, 503, 504), so
 * nothing for its app goes until it answers. `status`: what it answered otherwise.
 */
export type SendResult = { ok: true } | { ok: false; reason: string; down?: boolean; status?: number };
/** Sends one event to an app's part; says in words why it didn't get through. Never throws. */
export type SendEvent = (app: string, event: DomainEvent) => Promise<SendResult>;

export interface SendOptions {
  /** The gateway, which every call to a part goes through (GATEWAY_URL). */
  gatewayUrl: string;
  credentials: ServiceCredentials;
  fetchImpl?: typeof fetch;
}

/** What the gateway or a part answers when the part can't be reached, isn't there for AUGUR, or asks to wait, rather than refusing the event. */
const UNAVAILABLE = new Set([401, 403, 404, 408, 429, 502, 503, 504]);

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
      return { ok: false, reason: `${app}’s part couldn’t be reached: ${(err as Error).message}`, down: true };
    }
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const reason = `${app}’s part answered ${res.status}${body.message ? `: ${body.message}` : ''}`;
    return UNAVAILABLE.has(res.status) ? { ok: false, reason, down: true } : { ok: false, reason, status: res.status };
  };
};

export interface DelivererOptions {
  store: EventStore;
  /** The apps that subscribe: those the registry says hold events:subscribe, on or turned off. */
  subscribers: () => Promise<GrantedApp[]>;
  /** What an app holds on a floor; an event on a floor where it lacks events:subscribe isn't sent there. */
  grants: GrantLookup;
  /** What each app declares about events (ADR 0104): one that says what it reads is sent only that. */
  declaredEvents?: DeclaredEventsLookup;
  send: SendEvent;
  /** Records an event set aside, and an app's place forgotten; `key` makes a repeat harmless. */
  audit?: (entry: NewAuditEntry, key: string) => Promise<void>;
  /** Tries of an event its part can't take before it is set aside (DELIVERY_ATTEMPTS). */
  attempts?: number;
  /** The wait before such an event's second try, doubling after (RETRY_MS). */
  retryMs?: number;
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
  /** Events set aside: tried as often as allowed, or held for a day by a part that is down. */
  setAside: number;
  /** Apps whose place was behind what was pruned: they missed events and need rebuilding (ADR 0104). */
  behind: string[];
}

/** What a person reads about an app's deliveries in Admin → Apps; `since` is when the trouble began, for Admin to put a date to. */
export const deliveryStatus = (d: Delivery, now = Date.now()): { state: 'ok' | 'retrying' | 'stalled'; words: string } => {
  if (!d.failingSince) {
    const words = [d.deliveredAt ? 'Taking events.' : 'Nothing to deliver yet.'];
    if (d.dropped) words.push(`${d.dropped} ${d.dropped === 1 ? 'event was' : 'events were'} passed over after a day of failures.`);
    if (d.retrying) words.push(`${d.retrying} ${d.retrying === 1 ? 'event is' : 'events are'} being tried again.`);
    if (d.setAside) words.push(`${d.setAside} ${d.setAside === 1 ? 'event was set aside: the part couldn’t take it.' : 'events were set aside: the part couldn’t take them.'}`);
    return { state: d.retrying ? 'retrying' : 'ok', words: words.join(' ') };
  }
  const since = new Date(d.failingSince).getTime();
  const stalled = now - since >= STALLED_AFTER_MS;
  const reason = d.lastError ?? 'the part didn’t answer';
  return { state: stalled ? 'stalled' : 'retrying', words: `${stalled ? 'Not taking events' : 'Retrying'}: ${reason}.` };
};

/** Why nothing is being pushed to parts right now, when that is so; Admin shows it beside each subscribing app. */
export type PushingState = { on: true; problem?: string } | { on: false; why: string; whoCanChange: string };

const SERVICE_ACTOR = { id: 'events', kind: 'service' as const };

/** Whether an app takes events on a floor (none: the deployment's own): it holds events:subscribe there. Pushed and read alike. */
export const subscribesOn = async (grants: GrantLookup, app: string, floor: string | undefined): Promise<boolean> => (await grants(app, floor)).includes('events:subscribe');

/** Delivers to every subscribing app that is due; one pass at a time. */
export const eventDeliverer = ({ store, subscribers, grants, declaredEvents, send, audit, attempts: maxAttempts = DELIVERY_ATTEMPTS, retryMs = RETRY_MS, now = Date.now, batch = 100, leaseSeconds = LEASE_SECONDS, log }: DelivererOptions) => {
  let running: Promise<DeliveryReport> | undefined;
  let again = false;
  /** What stopped the last pass, if anything: the registry or the database not answering. */
  let problem: string | undefined;

  const move = async (app: string, row: Delivery, to: string, outcome: Outcome): Promise<Delivery | undefined> => {
    // Another instance got here first: its cursor stands.
    if (!(await store.deliveries.advance(app, row.cursor, to, outcome))) return undefined;
    return { ...row, cursor: to, failures: 0, failingSince: null, lastError: null, nextAt: null };
  };

  /** Puts the event beside the app's line and moves the cursor past it, together; undefined when another instance moved first. */
  const holdAndMove = async (app: string, row: Delivery, event: DomainEvent, how: HoldHow): Promise<Delivery | undefined> => {
    if (!(await store.deliveries.holdAndAdvance(app, row.cursor, event, how))) return undefined;
    return { ...row, cursor: event.seq, failures: 0, failingSince: null, lastError: null, nextAt: null };
  };

  const failedOnce = (report: DeliveryReport, app: string) => {
    if (!report.failed.includes(app)) report.failed.push(app);
  };

  /**
   * The events each app's part failed with a server error (500, say) since it last took one. A second, different
   * event failing so means the part is broken rather than one event bad: it is taken as down, so nothing is set aside
   * for a fault that would hit every event. Kept per instance; the lease means one instance drives an app at a time.
   */
  const serverErrors = new Map<string, Set<string>>();

  /** Whether a failed send means the part is down, holding every event for the app. */
  const isDown = (app: string, seq: string, sent: { down?: boolean; status?: number }) => {
    if (sent.down) return true;
    if (!sent.status || sent.status < 500) return false;
    const seen = serverErrors.get(app) ?? new Set<string>();
    seen.add(seq);
    serverErrors.set(app, seen);
    return seen.size >= 2;
  };

  /** Whether the app takes this event: not its own, a topic it reads, a floor where it subscribes. Undefined when that can't be asked. */
  const wantedBy = async (app: string, event: DomainEvent): Promise<boolean | undefined> => {
    if (event.publisher === app) return false;
    try {
      const reads = declaredEvents && readable((await declaredEvents(app))?.reads);
      return (!reads || topicMatches(event.topic, reads)) && (await subscribesOn(grants, app, event.workspace?.id));
    } catch (err) {
      if (!(err instanceof GrantsUnavailable)) throw err;
      log?.warn({ app, err: err.message }, 'could not check where an app subscribes; trying again later');
      problem = `The registry can’t be asked where apps subscribe (${err.message}).`;
      return undefined;
    }
  };

  /** Says an event was set aside: logged, and recorded once in Activity with what it was and why. */
  const setAside = async (app: string, event: { seq: string; id: string; topic: string }, attempts: number, reason: string, report: DeliveryReport) => {
    report.setAside++;
    log?.error({ app, seq: event.seq, topic: event.topic, attempts, reason }, 'event set aside: its part couldn’t take it');
    await audit?.({ actor: SERVICE_ACTOR, app: 'events', action: 'delivery.set-aside', target: app, detail: { seq: event.seq, id: event.id, topic: event.topic, attempts, reason } }, `delivery.set-aside:${app}:${event.seq}`);
  };

  /** Whether the part has been down for a day, so the event in front is set aside. */
  const downForADay = (row: Delivery) => row.failingSince !== null && now() - new Date(row.failingSince).getTime() >= GIVE_UP_AFTER_MS;

  /** Records the part down against the event above the cursor; nothing goes for the app until the wait is over. */
  const partDown = async (app: string, row: Delivery, seq: string, reason: string, report: DeliveryReport) => {
    const since = row.failingSince ? new Date(row.failingSince).getTime() : now();
    const nextAt = new Date(now() + backoffMs(row.failures + 1));
    // Recorded only against the event that failed: if another instance has moved on, the row is healthy and stays so.
    if (await store.deliveries.failed(app, row.cursor, reason, nextAt, new Date(since))) {
      failedOnce(report, app);
      log?.warn({ app, seq, reason, nextAt }, 'event delivery failed');
    }
  };

  /**
   * Tries again, first on each topic, the events held beside the app's line that are due; each that gets through lets
   * the next on its topic go. Answers the row, healthy once something got through, or undefined when the pass stops
   * there: the part is down, or the registry can't say what the app takes.
   */
  const retryHeld = async (app: string, row: Delivery, report: DeliveryReport): Promise<Delivery | undefined> => {
    for (const first of await store.deliveries.heldFirst(app)) {
      let held: HeldEvent | undefined = first;
      while (held && (!held.nextAt || new Date(held.nextAt).getTime() <= now())) {
        const [event] = await store.readEvents({ topics: [held.topic], after: (BigInt(held.seq) - 1n).toString(), upTo: held.seq, limit: 1 });
        // What the app takes may have changed while the event waited: one it no longer takes goes.
        const wanted = event ? await wantedBy(app, event) : true;
        if (wanted === undefined) return undefined;
        const sent: SendResult | undefined = !wanted ? undefined : event ? await send(app, event) : { ok: false, reason: 'It was pruned before its part took it' };
        if (!sent) {
          await store.deliveries.unhold(app, held.seq, false);
          report.skipped++;
        } else if (sent.ok) {
          await store.deliveries.unhold(app, held.seq, true);
          serverErrors.delete(app);
          row = { ...row, failures: 0, failingSince: null, lastError: null, nextAt: null };
          report.delivered++;
        } else if (event && isDown(app, held.seq, sent)) {
          if (!downForADay(row)) {
            await partDown(app, row, held.seq, sent.reason, report);
            return undefined;
          }
          // A day of the part being down: only this event, the one in front, is set aside, and the next gets a day of its own.
          const attempts = held.attempts + 1;
          await store.deliveries.retried(app, held.seq, { attempts, lastError: sent.reason, at: new Date(now()), setAside: true });
          await store.deliveries.newDay(app);
          row = { ...row, failures: 0, failingSince: null, lastError: null, nextAt: null };
          await setAside(app, held, attempts, sent.reason, report);
        } else {
          // Tried as often as allowed: set aside, so the events behind it can go.
          const attempts = held.attempts + 1;
          const last = !event || attempts >= maxAttempts;
          await store.deliveries.retried(app, held.seq, { attempts, lastError: sent.reason, at: new Date(now()), ...(last ? { setAside: true } : { nextAt: new Date(now() + retryBackoffMs(attempts, retryMs)) }) });
          if (!last) {
            failedOnce(report, app);
            log?.warn({ app, seq: held.seq, topic: held.topic, attempts, reason: sent.reason }, 'event delivery failed; it is tried again, and its topic waits');
            break;
          }
          await setAside(app, held, attempts, sent.reason, report);
        }
        await store.deliveries.renew(app, leaseSeconds).catch(() => undefined);
        [held] = await store.deliveries.heldFirst(app, held.topic);
      }
    }
    return row;
  };

  const deliverTo = async (app: string, enabled: boolean, report: DeliveryReport) => {
    let row = await store.deliveries.ensure(app);
    // A turned-off app keeps its place: what it missed waits for it to be turned on again.
    if (!enabled) return;
    if (row.nextAt && new Date(row.nextAt).getTime() > now()) return;
    if (!(await store.deliveries.claim(app, leaseSeconds))) return;
    try {
      const retried = await retryHeld(app, row, report);
      if (!retried) return;
      row = retried;
      // The topics with an event being tried again: later events on them wait behind it, so each topic keeps its order.
      const waiting = await store.deliveries.heldTopics(app);
      for (;;) {
        const events = await store.readEvents({ topics: ['*'], after: row.cursor, limit: batch });
        // A place behind what was pruned means events went before this app took them (asked after the read, so a prune
        // in between can't slip past): it is said once, the place moves up to what is left, and the read starts again.
        const pruned = await store.prunedUpTo();
        if (pruned !== undefined && BigInt(row.cursor) < BigInt(pruned)) {
          report.behind.push(app);
          log?.error({ app, cursor: row.cursor, prunedUpTo: pruned }, 'an app missed events that were pruned before it took them');
          await audit?.({ actor: SERVICE_ACTOR, app: 'events', action: 'delivery.gap', target: app, detail: { cursor: row.cursor, prunedUpTo: pruned } }, `delivery.gap:${app}:${row.cursor}`);
          const moved = await move(app, row, pruned, 'skipped');
          if (!moved) return;
          row = moved;
          continue;
        }
        if (events.length === 0) return;
        for (const event of events) {
          const wanted = await wantedBy(app, event);
          if (wanted === undefined) return;
          if (wanted && waiting.has(event.topic)) {
            // Its topic keeps its order: it waits beside the line, behind the event there being tried again.
            const moved = await holdAndMove(app, row, event, { attempts: 0 });
            if (!moved) return;
            row = moved;
            continue;
          }
          const sent = wanted ? await send(app, event) : undefined;
          if (sent && !sent.ok && isDown(app, event.seq, sent)) {
            if (!downForADay(row)) return void (await partDown(app, row, event.seq, sent.reason, report));
            // A day of the part being down: this event is set aside, kept, so the ones behind it can go.
            const attempts = row.failures + 1;
            const moved = await holdAndMove(app, row, event, { attempts, lastError: sent.reason, firstFailedAt: new Date(row.failingSince!), setAside: true });
            if (!moved) return;
            row = moved;
            await setAside(app, event, attempts, sent.reason, report);
            continue;
          }
          if (sent && !sent.ok) {
            // The part answered, but can't take this one: it is held beside the line, to be tried again, and the rest go on.
            const last = maxAttempts <= 1;
            const moved = await holdAndMove(app, row, event, { attempts: 1, lastError: sent.reason, firstFailedAt: new Date(now()), ...(last ? { setAside: true } : { nextAt: new Date(now() + retryBackoffMs(1, retryMs)) }) });
            if (!moved) return;
            row = moved;
            if (last) await setAside(app, event, 1, sent.reason, report);
            else {
              waiting.add(event.topic);
              failedOnce(report, app);
              log?.warn({ app, seq: event.seq, topic: event.topic, reason: sent.reason }, 'event delivery failed; it is tried again, and its topic waits');
            }
            continue;
          }
          const moved = await move(app, row, event.seq, sent ? 'sent' : 'skipped');
          if (!moved) return;
          row = moved;
          if (sent) {
            serverErrors.delete(app);
            report.delivered++;
          } else report.skipped++;
          // The lease is held for as long as events keep going through.
          await store.deliveries.renew(app, leaseSeconds).catch(() => undefined);
        }
        if (events.length < batch) return;
      }
    } finally {
      await store.deliveries.release(app).catch((err: unknown) => log?.warn({ app, err: String(err) }, 'could not give back an app’s delivery lease; it lapses by itself'));
    }
  };

  const pass = async (): Promise<DeliveryReport> => {
    const report: DeliveryReport = { delivered: 0, skipped: 0, failed: [], setAside: 0, behind: [] };
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
        return { delivered: 0, skipped: 0, failed: [], setAside: 0, behind: [] };
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
