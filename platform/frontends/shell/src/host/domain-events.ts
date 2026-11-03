import type { EventBus } from '@augur/mfe-sdk';
import { parseEvents } from './feed.js';

/** A domain event as the events service streams it to the browser: ids and a little context, never content. */
export interface BrowserDomainEvent {
  seq: string;
  /** "folio.document.published": the publisher's id, then what happened. */
  topic: string;
  id: string;
  publisher: string;
  at: string;
  workspace?: { id: string; path: string[] };
  payload: unknown;
}

/**
 * What the shell follows for the apps a person has on a floor: each app's own topics, and the
 * platform's. An app hears another's events only when that app is one the person has here too.
 */
export const topicsFor = (apps: readonly { id: string }[]) => [...new Set(apps.map((a) => `${a.id}.*`)), 'platform.*'].sort();

export interface DomainEventStreamOptions {
  getToken(): Promise<string>;
  /** The floor the person stands on: the stream carries that floor's events only. */
  floor: string;
  topics: readonly string[];
  /** Where each event goes: the shell's bus, by topic, so every mounted app and surface hears it. */
  bus: EventBus;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  retryMs?: number;
  maxRetryMs?: number;
}

/**
 * Follows the events service's browser stream once for the whole page and emits each event on the
 * bus under its topic (`useData(…, { refreshOn: [topic] })` listens there). It reconnects with
 * growing pauses when it drops. Nothing missed while it was down is replayed: a screen refreshes on
 * the next event, or when it loads. EventSource can't send the sign-in token, so it's read with fetch.
 */
export class DomainEventStream {
  private controller?: AbortController;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly opts: DomainEventStreamOptions) {
    // Called unbound: the browser's fetch throws "Illegal invocation" when called as a method of another object.
    const fetchImpl = opts.fetchImpl ?? fetch;
    this.fetchImpl = (...args) => fetchImpl(...args);
    this.baseUrl = opts.baseUrl ?? '/api/events/v1';
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
    const { retryMs = 1000, maxRetryMs = 30_000, topics, floor, bus } = this.opts;
    let pause = retryMs;
    const url = `${this.baseUrl}/domain-events/stream?topics=${encodeURIComponent(topics.join(','))}`;
    while (!signal.aborted) {
      try {
        const res = await this.fetchImpl(url, { headers: { authorization: `Bearer ${await this.opts.getToken()}`, 'x-workspace-id': floor }, signal });
        if (!res.ok || !res.body) throw new Error(`answered ${res.status}`);
        pause = retryMs;
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const parsed = parseEvents<BrowserDomainEvent>(buffer + value, 'domain-event');
          buffer = parsed.rest;
          // A handler that throws never stops the stream.
          for (const e of parsed.events) {
            try {
              bus.emit(e.topic, e);
            } catch (err) {
              console.error(`A handler for ${e.topic} failed`, err);
            }
          }
        }
      } catch {
        if (signal.aborted) return;
      }
      if (signal.aborted) return;
      await new Promise((r) => setTimeout(r, pause));
      pause = Math.min(pause * 2, maxRetryMs);
    }
  }
}
