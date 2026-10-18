import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/centre-menu.js';
import '../components/wave.js';
import type { MenuCategory, UiCentreMenu } from '../components/centre-menu.js';
import type { UiWaveBackground } from '../components/wave.js';

const meta: Meta = { title: 'Navigation/Centre menu', component: 'ui-centre-menu', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const share = [{ label: 'Open' }, { label: 'Pin to Home' }, { label: 'Information' }];

/** Orbit: the menu inside an app. Its categories ride a ring; items fall away below the focus. */
const library: MenuCategory[] = [
  { label: 'Home', icon: 'home', items: [{ label: 'Welcome', icon: 'star', detail: 'Start here' }, { label: 'Recent', icon: 'clock', detail: '6 items' }, { label: 'Pinned', icon: 'star', detail: '3 items' }] },
  {
    label: 'Documents',
    icon: 'folder',
    items: [
      { label: 'Reports', icon: 'document', detail: 'Updated today', options: share },
      { label: 'Drafts', icon: 'document', detail: '4 drafts', options: share },
      { label: 'Shared with me', icon: 'people', detail: '12 items', options: share },
      { label: 'Downloads', icon: 'download', detail: '2 new', options: share },
    ],
  },
  { label: 'Publishing', icon: 'library', items: [{ label: 'Published', icon: 'check', detail: '48 documents' }, { label: 'Waiting for review', icon: 'clock', detail: '2 need you' }] },
  { label: 'Assistant', icon: 'agents', ai: true, items: [{ label: 'Ask your libraries', icon: 'agents', ai: true, detail: 'Answers with sources' }, { label: 'Summaries', icon: 'document', detail: '3 running' }] },
  { label: 'Insights', icon: 'chart', items: [{ label: 'Readership', icon: 'chart', detail: 'Up 12% this month' }] },
  { label: 'Settings', icon: 'settings', items: [{ label: 'Departments', icon: 'people', detail: 'Finance, Legal' }, { label: 'Notifications', icon: 'bell', detail: 'Daily digest' }] },
];

/** Title: the selector. Each chapter is an app, and Enter opens it. */
const apps: MenuCategory[] = [
  { label: 'Home', icon: 'home', items: [{ label: 'Home', icon: 'home', detail: 'What needs you' }] },
  { label: 'Library', icon: 'library', items: [{ label: 'Documents', icon: 'folder', detail: '12 documents' }, { label: 'Publishing', icon: 'library', detail: '2 need you' }] },
  { label: 'Assistant', icon: 'agents', ai: true, items: [{ label: 'Assistant', icon: 'agents', ai: true, detail: 'Ask your libraries' }] },
  { label: 'Admin', icon: 'admin', items: [{ label: 'People', icon: 'people', detail: '84 people' }, { label: 'Apps', icon: 'apps', detail: '5 apps' }] },
];

const stage = (variant: 'orbit' | 'title', categories: MenuCategory[], preset: string, extra: { labels?: 'all' | 'focus' } = {}) => html`
  <div style="position:relative;height:100vh;min-height:560px;overflow:hidden">
    <ui-wave-background preset=${preset}></ui-wave-background>
    <ui-centre-menu
      variant=${variant}
      labels=${extra.labels ?? 'focus'}
      start-category="1"
      hints="always"
      .categories=${categories}
      @ui-select=${(e: CustomEvent) => console.info('open', e.detail.item.label)}
      @ui-back=${() => console.info('back')}
    ></ui-centre-menu>
  </div>`;

const connect = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const menu = canvasElement.querySelector('ui-centre-menu') as UiCentreMenu;
    menu.background = canvasElement.querySelector('ui-wave-background') as UiWaveBackground;
    await menu.updateComplete;
    menu.focus();
  },
};

/** Drag to spin; arrows, wheel, Enter, right-click, or just type. Pair Orbit with Deep Ocean. */
export const Orbit: Story = { render: () => stage('orbit', library, 'Deep Ocean'), ...connect };
/** Pair Title with Minimal. */
export const Title: Story = { render: () => stage('title', apps, 'Minimal'), ...connect };
/** Every item named to its right, for people who can't scan a column of icons. */
export const AllLabels: Story = { render: () => stage('orbit', library, 'Deep Ocean', { labels: 'all' }), ...connect };
