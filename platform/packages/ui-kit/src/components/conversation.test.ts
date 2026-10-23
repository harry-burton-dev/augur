import { beforeEach, describe, expect, it } from 'vitest';
import './conversation.js';
import type { ConversationItem, UiConversation } from './conversation.js';

let el: UiConversation;
const root = () => el.shadowRoot!;
const field = () => root().querySelector('textarea')!;
const type = async (text: string) => {
  field().value = text;
  field().dispatchEvent(new Event('input'));
  await el.updateComplete;
};
const enter = (shiftKey = false) => field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey, bubbles: true, cancelable: true }));

beforeEach(async () => {
  document.body.innerHTML = '<ui-conversation agent="Assistant" greeting="What can I do?"></ui-conversation>';
  el = document.querySelector('ui-conversation')!;
  await el.updateComplete;
});

describe('ui-conversation', () => {
  it('shows who said what, the agent’s lines in the bubble', async () => {
    el.items = [
      { id: '1', from: 'person', text: 'Find the travel policy' },
      { id: '2', from: 'agent', text: 'Here it is.' },
      { id: '3', from: 'note', text: 'Library opened.' },
    ];
    await el.updateComplete;
    const lines = [...root().querySelectorAll('.line, .note')].map((l) => [l.className, l.querySelector('.who')?.textContent, (l.querySelector('.said') ?? l).textContent]);
    expect(lines).toEqual([
      ['line agent', 'Assistant', 'What can I do?'],
      ['line person', 'You', 'Find the travel policy'],
      ['line agent', 'Assistant', 'Here it is.'],
      ['note', undefined, 'Library opened.'],
    ]);
  });

  it('sends on Enter, keeps Shift+Enter for a new line, and sends nothing empty', async () => {
    const sent: string[] = [];
    el.addEventListener('ui-send', (e) => sent.push((e as CustomEvent).detail.text));
    await type('  ');
    enter();
    await type('Hello\nthere ');
    enter(true);
    expect(sent).toEqual([]);
    enter();
    await el.updateComplete;
    expect(sent).toEqual(['Hello\nthere']);
    expect(field().value).toBe('');
  });

  it('sends nothing while the agent thinks', async () => {
    const sent: string[] = [];
    el.addEventListener('ui-send', (e) => sent.push((e as CustomEvent).detail.text));
    el.busy = true;
    await type('Hello');
    enter();
    expect(sent).toEqual([]);
    expect(root().querySelector('.thinking')!.textContent).toContain('Thinking');
  });

  it('asks before an agent does anything, and waits for the answer', async () => {
    const asked: ConversationItem = { id: 'c1', from: 'confirm', heading: 'Open Q3 report in Library?', app: 'Library', state: 'asking' };
    el.items = [asked];
    await el.updateComplete;
    expect(el.asking).toBe(true);
    expect(field().disabled).toBe(true);
    const card = root().querySelector('ui-confirm-card')!;
    await card.updateComplete;
    const answers: string[] = [];
    el.addEventListener('ui-allow', (e) => answers.push(`allow ${(e as CustomEvent).detail.item.id}`));
    el.addEventListener('ui-decline', (e) => answers.push(`decline ${(e as CustomEvent).detail.item.id}`));
    const [allow, notNow] = [...card.shadowRoot!.querySelectorAll('ui-button')];
    expect([allow.textContent, notNow.textContent]).toEqual(['Allow', 'Not now']);
    allow.click();
    notNow.click();
    expect(answers).toEqual(['allow c1', 'decline c1']);
    el.items = [{ ...asked, state: 'allowed' }];
    await el.updateComplete;
    await root().querySelector('ui-confirm-card')!.updateComplete;
    expect(root().querySelector('ui-confirm-card')!.shadowRoot!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Allowed: Open Q3 report in Library?');
    expect(field().disabled).toBe(false);
  });

  it('says what went wrong and offers to try again', async () => {
    let retried = false;
    el.addEventListener('ui-retry', () => (retried = true));
    el.error = 'Assistant has used its calls for today.';
    await el.updateComplete;
    const state = root().querySelector('ui-state')!;
    expect(state.getAttribute('heading')).toBe('Assistant has used its calls for today.');
    state.dispatchEvent(new CustomEvent('ui-action'));
    expect(retried).toBe(true);
  });
});
