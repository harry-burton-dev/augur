import '@remote-dom/core/polyfill';
import { createRemoteElement } from '@remote-dom/core/elements';
import { beforeAll, describe, expect, it } from 'vitest';
import { reconcile } from './tree.js';

beforeAll(() => {
  customElements.define('quill-text-field', createRemoteElement({ properties: { label: { attribute: false }, value: { attribute: false } }, events: ['change'] }) as unknown as CustomElementConstructor);
});

const field = (value: string, onChange?: (v: unknown) => void) => ({ type: 'quill-text-field', props: { label: 'Title', value, ...(onChange ? { onChange } : {}) } });

describe('rendering a description into a remote root', () => {
  it('keeps an element that stays the same kind at its place, so a field keeps its identity', () => {
    const root = document.createElement('div');
    reconcile(root, [field('a'), 'some text']);
    const first = root.firstChild;
    reconcile(root, [field('b'), 'other text']);
    expect(root.firstChild).toBe(first);
    expect((first as unknown as { value: string }).value).toBe('b');
    expect(root.childNodes[1]!.textContent).toBe('other text');
    reconcile(root, [{ type: 'quill-text-field' }]);
    expect(root.childNodes).toHaveLength(1);
    expect((first as unknown as { label?: string }).label).toBeUndefined();
  });

  it('clears a field the person typed into when the app sets it back to what it was', () => {
    const root = document.createElement('div');
    reconcile(root, field(''));
    const el = root.firstChild as unknown as { value: string };
    el.value = 'typed by the person';
    reconcile(root, field(''));
    expect(el.value).toBe('');
  });

  it('calls the latest handler with the event’s detail, listening once', () => {
    const root = document.createElement('div');
    const heard: string[] = [];
    reconcile(root, field('', (v) => heard.push(`first ${String(v)}`)));
    reconcile(root, field('', (v) => heard.push(`second ${String(v)}`)));
    root.firstChild!.dispatchEvent(new CustomEvent('change', { detail: 'x' }));
    expect(heard).toEqual(['second x']);
  });

  it('stops hearing an event when the handler is set back to nothing', () => {
    const root = document.createElement('div');
    const heard: unknown[] = [];
    reconcile(root, field('', (v) => heard.push(v)));
    reconcile(root, { type: 'quill-text-field', props: { label: 'Title', value: '', onChange: undefined } });
    root.firstChild!.dispatchEvent(new CustomEvent('change', { detail: 'x' }));
    expect(heard).toEqual([]);
  });
});
