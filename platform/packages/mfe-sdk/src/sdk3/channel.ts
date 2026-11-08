/**
 * The bridge between an app's worker and the shell's host (spec 6.6), over the worker's own
 * `postMessage`. Both ends use this: remote-dom's mutation records travel one way as `mutate`, and the
 * SDK's calls travel as `call` and come back as `answer`. A function can't be cloned, so each end
 * swaps one for `{ __fn: id }` and the other end gets a stand-in that calls it back: that is how the
 * host fires an element's event listener in the worker.
 *
 * Neither end trusts the other's messages: a malformed one is ignored, and the host decides what a
 * call may do (it sets the app's id itself; nothing the worker sends names one).
 */

/** What a message travels over: a `Worker` on the host's side, the worker's global scope on the app's. */
export interface Port {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

/** A call's answer, or why it failed. */
type Answer = { kind: 'answer'; n: number; ok: true; value: unknown } | { kind: 'answer'; n: number; ok: false; error: { name: string; message: string } };

/** Every message on the bridge. */
export type Message =
  | { kind: 'call'; n: number; method: string; args: unknown[] }
  | { kind: 'post'; method: string; args: unknown[] }
  | { kind: 'fn'; n: number; id: string; args: unknown[] }
  | { kind: 'mutate'; root: string; records: unknown[] }
  | Answer;

/** Answers a call by name; what it returns (or throws) goes back to the caller. */
export type Handler = (method: string, args: unknown[]) => unknown;

const FN = '__fn';
const isPlain = (v: object) => {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** Something the bridge's other end may hold: plain values and functions; bytes are cloned as they are. */
const isMessage = (m: unknown): m is Message => !!m && typeof m === 'object' && typeof (m as { kind?: unknown }).kind === 'string';

/** Whether a rejected call's error says what went wrong: only its name and message cross. */
const errorOf = (err: unknown) => ({ name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err) });

export class Channel {
  readonly #port: Port;
  readonly #handle: Handler;
  readonly #fns = new Map<string, (...args: unknown[]) => unknown>();
  readonly #ids = new WeakMap<object, string>();
  readonly #pending = new Map<number, { resolve(v: unknown): void; reject(e: unknown): void }>();
  readonly #listener: (event: MessageEvent) => void;
  #next = 0;
  #seq = 0;
  #closed = false;
  /** Mutation records from the other end, by root. */
  onMutate?: (root: string, records: unknown[]) => void;

  constructor(port: Port, handle: Handler) {
    this.#port = port;
    this.#handle = handle;
    this.#listener = (event) => void this.#receive(event.data);
    port.addEventListener('message', this.#listener);
  }

  /** Calls `method` at the other end and waits for its answer. */
  call(method: string, ...args: unknown[]): Promise<unknown> {
    return this.#request({ kind: 'call', method, args: this.#encode(args) as unknown[] });
  }

  /** Tells the other end something, with no answer. */
  post(method: string, ...args: unknown[]) {
    this.#send({ kind: 'post', method, args: this.#encode(args) as unknown[] });
  }

  /** Sends a batch of remote-dom mutation records for one root. */
  mutate(root: string, records: readonly unknown[]) {
    this.#send({ kind: 'mutate', root, records: this.#encode(records) as unknown[] });
  }

  /** Stops listening; calls still waiting are refused. */
  close(reason = 'The app stopped.') {
    if (this.#closed) return;
    this.#closed = true;
    this.#port.removeEventListener('message', this.#listener);
    for (const p of this.#pending.values()) p.reject(new Error(reason));
    this.#pending.clear();
    this.#fns.clear();
  }

  #send(message: Message) {
    if (this.#closed) return;
    // Bytes move rather than copy: a large download crosses once.
    const transfer: Transferable[] = [];
    collectBuffers(message, transfer);
    this.#port.postMessage(message, transfer);
  }

  #request(message: { kind: 'call'; method: string; args: unknown[] } | { kind: 'fn'; id: string; args: unknown[] }): Promise<unknown> {
    if (this.#closed) return Promise.reject(new Error('The app stopped.'));
    return new Promise((resolve, reject) => {
      const n = this.#seq++;
      this.#pending.set(n, { resolve, reject });
      this.#send({ ...message, n } as Message);
    });
  }

  #encode(v: unknown): unknown {
    if (typeof v === 'function') {
      let id = this.#ids.get(v);
      if (!id) {
        id = `f${this.#next++}`;
        this.#ids.set(v, id);
        this.#fns.set(id, v as (...args: unknown[]) => unknown);
      }
      return { [FN]: id };
    }
    if (Array.isArray(v)) return v.map((x) => this.#encode(x));
    if (v && typeof v === 'object' && isPlain(v)) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = this.#encode(x);
      return out;
    }
    return v;
  }

  #decode(v: unknown): unknown {
    if (Array.isArray(v)) return v.map((x) => this.#decode(x));
    if (v && typeof v === 'object' && isPlain(v)) {
      const fn = (v as Record<string, unknown>)[FN];
      if (typeof fn === 'string' && Object.keys(v).length === 1) return (...args: unknown[]) => this.#request({ kind: 'fn', id: fn, args: this.#encode(args) as unknown[] });
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = this.#decode(x);
      return out;
    }
    return v;
  }

  async #receive(m: unknown) {
    if (this.#closed || !isMessage(m)) return;
    if (m.kind === 'mutate') {
      if (typeof m.root === 'string' && Array.isArray(m.records)) this.onMutate?.(m.root, this.#decode(m.records) as unknown[]);
      return;
    }
    if (m.kind === 'answer') {
      const p = this.#pending.get(m.n);
      if (!p) return;
      this.#pending.delete(m.n);
      if (m.ok) p.resolve(this.#decode(m.value));
      else p.reject(Object.assign(new Error(String(m.error?.message ?? 'The call failed.')), { name: String(m.error?.name ?? 'Error') }));
      return;
    }
    if (!Array.isArray(m.args)) return;
    const args = this.#decode(m.args) as unknown[];
    if (m.kind === 'post') {
      try {
        await this.#handle(String(m.method), args);
      } catch {
        // Nobody waits for a post's answer.
      }
      return;
    }
    if (m.kind !== 'call' && m.kind !== 'fn') return;
    try {
      const fn = m.kind === 'fn' ? this.#fns.get(String(m.id)) : undefined;
      if (m.kind === 'fn' && !fn) throw new Error('That listener is gone.');
      const value = await (fn ? fn(...args) : this.#handle(String((m as { method?: unknown }).method), args));
      this.#send({ kind: 'answer', n: m.n, ok: true, value: this.#encode(value) });
    } catch (err) {
      this.#send({ kind: 'answer', n: m.n, ok: false, error: errorOf(err) });
    }
  }
}

/** The ArrayBuffers a message carries at its top levels (a call's arguments or answer), to transfer rather than copy. */
function collectBuffers(m: Message, into: Transferable[]) {
  const values = 'args' in m ? m.args : m.kind === 'answer' && m.ok ? [m.value] : [];
  for (const v of values) {
    if (v instanceof ArrayBuffer) into.push(v);
    else if (v && typeof v === 'object' && isPlain(v)) for (const x of Object.values(v)) if (x instanceof ArrayBuffer && !into.includes(x)) into.push(x);
  }
}
