import { describe, expect, it } from 'vitest';
import './icon.js';
import { iconNames, type UiIcon } from './icon.js';

const mount = async (markup: string) => {
  document.body.innerHTML = markup;
  const el = document.body.querySelector('ui-icon') as UiIcon;
  await el.updateComplete;
  return el;
};

describe('ui-icon', () => {
  it('draws every named icon from the pack', async () => {
    for (const name of iconNames) {
      const el = await mount(`<ui-icon name="${name}"></ui-icon>`);
      const shapes = el.shadowRoot!.querySelectorAll('svg > *');
      expect(shapes.length, name).toBeGreaterThan(0);
    }
  });

  it('keeps the names apps and the shell already use', () => {
    for (const name of ['apps', 'find', 'agents', 'account', 'settings', 'home', 'library', 'document', 'folder', 'admin', 'close', 'back', 'arrow', 'check']) {
      expect(iconNames).toContain(name);
    }
  });

  it('draws nothing for an unknown name', async () => {
    const el = await mount('<ui-icon name="nope"></ui-icon>');
    expect(el.shadowRoot!.querySelector('svg')).toBeNull();
  });

  it('is hidden from readers unless labelled', async () => {
    const bare = await mount('<ui-icon name="find"></ui-icon>');
    expect(bare.shadowRoot!.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    const named = await mount('<ui-icon name="find" label="Find"></ui-icon>');
    expect(named.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).toBe('Find');
  });
});
