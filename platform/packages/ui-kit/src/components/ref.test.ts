import { describe, expect, it, vi } from 'vitest';
import './ref.js';
import { refIcon } from './ref.js';
import type { UiRef, UiRefs } from './ref.js';

const settle = async (el: { updateComplete: Promise<unknown> }) => {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};

describe('ui-ref', () => {
  it('shows the kind’s icon, the name and the floor it’s kept on, and opens', async () => {
    const el = document.createElement('ui-ref') as UiRef;
    el.ref = { kind: 'entity', id: 'ent_1', type: 'vessel', label: 'Northern Tern', floorKind: 'org', floorName: 'Coastguard' };
    document.body.replaceChildren(el);
    await settle(el);
    const root = el.shadowRoot!;
    expect(root.querySelector('ui-icon')!.getAttribute('name')).toBe('vessel');
    expect(root.querySelector('.name')!.textContent).toBe('Northern Tern');
    expect(root.querySelector('.dot')!.getAttribute('style')).toContain('--floor-org-high');
    expect(root.querySelector('.open')!.getAttribute('title')).toBe('Kept on Coastguard');
    const open = vi.fn();
    el.addEventListener('ui-open', open);
    (root.querySelector('.open') as HTMLButtonElement).click();
    expect(open.mock.calls[0]![0].detail.ref.id).toBe('ent_1');
    expect(root.querySelector('.remove')).toBeNull();
  });

  it('can be removed, unless it came from somewhere else', async () => {
    const el = document.createElement('ui-ref') as UiRef;
    el.ref = { kind: 'document', id: 'd1', title: 'Travel policy v3' };
    el.removable = true;
    document.body.replaceChildren(el);
    await settle(el);
    const remove = vi.fn();
    el.addEventListener('ui-remove', remove);
    (el.shadowRoot!.querySelector('.remove') as HTMLButtonElement).click();
    expect(remove).toHaveBeenCalledOnce();
    el.ref = { ...el.ref, from: 'Keep the coast watched' };
    await settle(el);
    expect(el.shadowRoot!.querySelector('.remove')).toBeNull();
  });

  it('picks icons by kind', () => {
    expect(refIcon({ kind: 'entity', type: 'widget' })).toBe('atlas');
    expect(refIcon({ kind: 'intent' })).toBe('compass');
    expect(refIcon({ kind: 'team' })).toBe('people');
  });
});

describe('ui-refs', () => {
  it('counts what you can’t open rather than dropping it, and says why', async () => {
    const el = document.createElement('ui-refs') as UiRefs;
    el.refs = [{ kind: 'person', id: 'p1', label: 'Nora Briggs' }];
    el.closedCount = 2;
    el.closedReason = 'Kept on Finance. Ask its leads.';
    document.body.replaceChildren(el);
    await settle(el);
    const root = el.shadowRoot!;
    expect(root.querySelectorAll('ui-ref')).toHaveLength(1);
    expect(root.querySelector('.closed')!.textContent).toContain('2 you can’t open');
    expect(root.querySelector('.closed')!.getAttribute('aria-describedby')).toBe('closed-reason');
    expect(root.querySelector('#closed-reason')!.textContent).toBe('Kept on Finance. Ask its leads.');
  });

  it('says its empty words when there are none', async () => {
    const el = document.createElement('ui-refs') as UiRefs;
    el.empty = 'No entities yet.';
    document.body.replaceChildren(el);
    await settle(el);
    expect(el.shadowRoot!.textContent!.trim()).toBe('No entities yet.');
  });
});
