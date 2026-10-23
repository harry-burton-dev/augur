import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/menu.js';
import '../components/icon-button.js';
import type { MenuEntry, UiMenu } from '../components/menu.js';

const items: MenuEntry[] = [
  { id: 'open', label: 'Open', icon: 'arrow', key: '↵' },
  '-',
  { id: 'mute', label: 'Mute Library', icon: 'mute', key: 'M' },
  { id: 'share', label: 'Share with Finance', icon: 'people', disabled: true },
  '-',
  { id: 'delete', label: 'Delete', danger: true, key: 'Del' },
];

const meta: Meta = {
  title: 'Lists/Menu',
  component: 'ui-menu',
  render: () => html`<div style="padding:var(--space-6);display:flex;justify-content:flex-end;max-width:var(--measure-read)">
    <ui-icon-button icon="more" label="More actions" @click=${(e: Event) => {
      const menu = (e.currentTarget as HTMLElement).nextElementSibling as UiMenu;
      menu.toggle(e.currentTarget as HTMLElement);
    }}></ui-icon-button>
    <ui-menu label="Actions" .items=${items} @ui-select=${(e: CustomEvent) => console.info('picked', e.detail.item.id)}></ui-menu>
  </div>`,
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('ui-icon-button') as HTMLElement;
    await (canvasElement.querySelector('ui-menu') as UiMenu).show(button);
  },
};
export default meta;
type Story = StoryObj;

/** A short list of actions from a button; keys shown; danger last, in red, behind a line. */
export const Default: Story = {};
