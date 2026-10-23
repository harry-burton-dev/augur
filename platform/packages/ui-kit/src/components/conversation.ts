import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';
import './button.js';
import './icon.js';
import './state.js';

/**
 * An agent asks to do something: the person sees exactly what, and nothing
 * happens until they allow it. Once answered, it stays as a line saying what
 * they chose.
 *
 * @fires ui-allow - detail `{}` when Allow is pressed
 * @fires ui-decline - detail `{}` when Not now is pressed
 */
export class UiConfirmCard extends LitElement {
  static override properties = {
    heading: { type: String },
    detail: { type: String },
    app: { type: String },
    state: { type: String, reflect: true },
  };

  /** What will be done, as a question: "Open Q3 report in Library?". */
  declare heading: string;
  /** What exactly, when the heading can't say it all. */
  declare detail: string;
  /** The app that will do it. */
  declare app: string;
  declare state: 'asking' | 'allowed' | 'declined';

  constructor() {
    super();
    this.heading = '';
    this.detail = '';
    this.app = '';
    this.state = 'asking';
  }

  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector<HTMLElement>('ui-button')?.focus(options);
  }

  private answer(allowed: boolean) {
    this.dispatchEvent(new CustomEvent(allowed ? 'ui-allow' : 'ui-decline', { detail: {}, bubbles: true, composed: true }));
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: block; max-width: var(--measure-decision); }
      .card { padding: var(--space-4) var(--space-5); border-radius: var(--radius-card); background: var(--surface-raised); box-shadow: var(--shadow-raised), inset 0 0 0 1px var(--hairline-strong); }
      :host([state='asking']) .card { box-shadow: var(--shadow-raised), inset 0 0 0 1px color-mix(in srgb, var(--green) 55%, transparent); }
      .eyebrow { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
      h3 { margin: 0; font-size: var(--type-lead); line-height: var(--leading-lead); font-weight: var(--weight-lead); }
      p { margin: var(--space-1) 0 0; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .actions { display: flex; gap: var(--space-3); margin-top: var(--space-4); }
      .done { display: flex; align-items: center; gap: var(--space-2); font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
    `,
  ];

  override render() {
    if (this.state !== 'asking') {
      return html`<div class="done" role="status"><ui-icon name=${this.state === 'allowed' ? 'check' : 'close'} size="14"></ui-icon>
        <span>${this.state === 'allowed' ? 'Allowed' : 'Not now'}: ${this.heading}</span></div>`;
    }
    return html`<div class="card" role="group" aria-label=${`Asks: ${this.heading}`}>
      <div class="eyebrow label"><ui-icon name="agents" size="14"></ui-icon>${this.app ? `Asks to use ${this.app}` : 'Asks to'}</div>
      <h3>${this.heading}</h3>
      ${this.detail ? html`<p>${this.detail}</p>` : nothing}
      <div class="actions">
        <ui-button kind="primary" ai @click=${() => this.answer(true)}>Allow</ui-button>
        <ui-button kind="tertiary" @click=${() => this.answer(false)}>Not now</ui-button>
      </div>
    </div>`;
  }
}

/** One line of a conversation, or an agent asking to do something. */
export type ConversationItem =
  | { id: string; from: 'person' | 'agent'; text: string }
  /** Something the person should know that neither of them said: "Library opened.", "Started a new conversation." */
  | { id: string; from: 'note'; text: string }
  | { id: string; from: 'confirm'; heading: string; detail?: string; app?: string; state: 'asking' | 'allowed' | 'declined' };

/**
 * A conversation with an agent: what each said, newest at the bottom, and a
 * field to write in. The agent's lines carry the bubble that marks AI; the
 * person's sit at the right, plain. When the agent asks to do something it is
 * a confirmation card, and the field waits until the person answers it.
 *
 * Keys: Enter sends, Shift+Enter starts a new line.
 *
 * @fires ui-send - detail `{ text }`; the host adds it to `items`
 * @fires ui-allow - detail `{ item }` when a confirmation is allowed
 * @fires ui-decline - detail `{ item }` when it is declined
 * @fires ui-retry - Try again was chosen after an error
 */
export class UiConversation extends LitElement {
  static override properties = {
    agent: { type: String },
    greeting: { type: String },
    items: { attribute: false },
    busy: { type: Boolean, reflect: true },
    error: { type: String },
    placeholder: { type: String },
    disabled: { type: Boolean, reflect: true },
    draft: { state: true },
  };

  /** Who the person is talking to: "Assistant". */
  declare agent: string;
  /** What the agent says first, before anything else is said. */
  declare greeting: string;
  declare items: ConversationItem[];
  /** The agent is thinking: a line says so, and nothing can be sent. */
  declare busy: boolean;
  /** What went wrong with the last thing sent, in words, with Try again. */
  declare error: string;
  declare placeholder: string;
  /** Nothing can be sent at all, such as while agents are off. */
  declare disabled: boolean;
  private declare draft: string;

  constructor() {
    super();
    this.agent = '';
    this.greeting = '';
    this.items = [];
    this.busy = false;
    this.error = '';
    this.placeholder = '';
    this.disabled = false;
    this.draft = '';
  }

  override focus(options?: FocusOptions) {
    const asking = this.renderRoot.querySelector<HTMLElement>('ui-confirm-card[state="asking"]');
    (asking ?? this.renderRoot.querySelector<HTMLElement>('textarea'))?.focus(options);
  }

  /** Whether a confirmation is waiting: then nothing new can be sent. */
  get asking() {
    return this.items.some((i) => i.from === 'confirm' && i.state === 'asking');
  }

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private send() {
    const text = this.draft.trim();
    if (!text || this.busy || this.disabled || this.asking) return;
    this.draft = '';
    this.emit('ui-send', { text });
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      this.send();
    }
  }

  protected override updated(changed: Map<string, unknown>) {
    if (changed.has('items') || changed.has('busy')) {
      const log = this.renderRoot.querySelector('.log');
      log?.scrollTo?.({ top: log.scrollHeight });
      if (changed.has('items') && this.asking) this.renderRoot.querySelector<HTMLElement>('ui-confirm-card[state="asking"]')?.focus();
    }
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: flex; flex-direction: column; min-height: 0; height: 100%; }
      .log { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5) var(--space-4); }
      .said { white-space: pre-wrap; }
      .line { max-width: var(--measure-read); overflow-wrap: anywhere; font-size: var(--type-body); line-height: var(--leading-body); }
      .who { margin-bottom: var(--space-1); }
      .person { align-self: flex-end; padding: var(--space-3) var(--space-4); border-radius: var(--radius-card); background: color-mix(in srgb, var(--ink) 7%, transparent); }
      /* Bubble marks AI: light from above, a green rim light from below. */
      .agent { align-self: flex-start; padding: var(--space-3) var(--space-4); border-radius: var(--radius-card); font-family: var(--font-rounded);
        background: radial-gradient(120% 140% at 50% 0%, color-mix(in srgb, var(--light) 8%, transparent), transparent 60%);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--light) 18%, transparent), inset 0 -6px 12px color-mix(in srgb, var(--green) 18%, transparent), 0 0 0 1px color-mix(in srgb, var(--green) 35%, transparent); }
      .note { align-self: center; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .thinking { align-self: flex-start; display: flex; align-items: center; gap: var(--space-2); font-size: var(--type-small); color: var(--ink-muted); }
      .thinking i { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: ui-ping var(--motion-ping) var(--ease-ping) infinite; --ping-scale: 1.4; }
      .error { align-self: stretch; }
      form { display: flex; align-items: flex-end; gap: var(--space-3); padding: var(--space-3) var(--space-4) var(--space-4); border-top: 1px solid var(--hairline); }
      textarea { flex: 1; resize: none; min-height: 44px; max-height: 160px; padding: var(--space-3) var(--space-4); border-radius: var(--radius-inset); border: 1px solid var(--hairline-strong); background: var(--surface-inset); color: var(--ink); font: inherit; font-size: var(--type-body); line-height: var(--leading-body); field-sizing: content; }
      textarea:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 1px; }
      textarea:disabled { opacity: 0.5; }
    `,
  ];

  private renderItem(item: ConversationItem) {
    if (item.from === 'confirm') {
      return html`<ui-confirm-card heading=${item.heading} detail=${item.detail ?? ''} app=${item.app ?? ''} state=${item.state}
        @ui-allow=${(e: Event) => (e.stopPropagation(), this.emit('ui-allow', { item }))}
        @ui-decline=${(e: Event) => (e.stopPropagation(), this.emit('ui-decline', { item }))}></ui-confirm-card>`;
    }
    if (item.from === 'note') return html`<p class="note">${item.text}</p>`;
    return html`<div class="line ${item.from}"><div class="who label">${item.from === 'agent' ? this.agent || 'Agent' : 'You'}</div><span class="said">${item.text}</span></div>`;
  }

  override render() {
    const waiting = this.asking;
    const blocked = this.busy || this.disabled || waiting;
    const hint = this.disabled ? 'Agents are off.' : waiting ? 'Answer the question above first.' : this.placeholder || `Ask ${this.agent || 'the agent'}…`;
    return html`<div class="log" role="log" aria-live="polite" aria-label=${`Conversation with ${this.agent || 'the agent'}`}>
        ${this.greeting ? html`<div class="line agent"><div class="who label">${this.agent || 'Agent'}</div><span class="said">${this.greeting}</span></div>` : nothing}
        ${this.items.map((item) => this.renderItem(item))}
        ${this.busy ? html`<div class="thinking" aria-label=${`${this.agent || 'The agent'} is thinking`}><i></i>Thinking…</div>` : nothing}
        ${this.error
          ? html`<ui-state class="error" kind="error" heading=${this.error} action="Try again" @ui-action=${() => this.emit('ui-retry', {})}></ui-state>`
          : nothing}
      </div>
      <form @submit=${(e: Event) => (e.preventDefault(), this.send())}>
        <textarea rows="1" aria-label=${`Message to ${this.agent || 'the agent'}`} placeholder=${hint} .value=${this.draft} ?disabled=${this.disabled || waiting}
          @input=${(e: Event) => (this.draft = (e.target as HTMLTextAreaElement).value)} @keydown=${this.onKey}></textarea>
        <ui-button kind="primary" ai ?disabled=${blocked || !this.draft.trim()} @click=${() => this.send()}>Send</ui-button>
      </form>`;
  }
}

if (!customElements.get('ui-confirm-card')) customElements.define('ui-confirm-card', UiConfirmCard);
if (!customElements.get('ui-conversation')) customElements.define('ui-conversation', UiConversation);

declare global {
  interface HTMLElementTagNameMap {
    'ui-confirm-card': UiConfirmCard;
    'ui-conversation': UiConversation;
  }
}
