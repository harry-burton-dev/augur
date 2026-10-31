import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/ref.js';
import '../components/section.js';
import { onGround } from './app-ground.js';

/** Things from any app, as chips that open where you are. What you can't open is counted, never dropped. */
const meta: Meta = { title: 'App/References' };
export default meta;
type Story = StoryObj;

export const KindsAndStates: Story = {
  render: () =>
    onGround(
      html`<ui-refs .refs=${[
        { kind: 'entity', id: 'e1', type: 'vessel', label: 'Northern Tern' },
        { kind: 'intent', id: 'i1', title: 'Pilot cover for night tides' },
        { kind: 'document', id: 'd1', title: 'Travel policy v3', floorKind: 'org', floorName: 'Coastguard' },
        { kind: 'team', id: 't1', label: 'Northern ports' },
        { kind: 'person', id: 'p1', label: 'Nora Briggs' },
        { kind: 'entity', id: 'e2', type: 'port', label: 'Port Halden', from: 'Keep the coast watched' },
      ]} removable closed-count="2" closed-reason="Kept on Finance. Ask its leads to share them."></ui-refs>`,
      '640px',
    ),
};

export const BoundTo: Story = {
  render: () =>
    onGround(
      html`<div style="display:grid;gap:var(--space-6)">
        <ui-section label="Bound to" count="3" limit="0" action="Bind an entity">
          <ui-refs removable .refs=${[
            { kind: 'entity', id: 'e1', type: 'vessel', label: 'Northern Tern' },
            { kind: 'entity', id: 'e2', type: 'port', label: 'Port Halden', from: 'Keep the coast watched' },
            { kind: 'entity', id: 'e3', type: 'facility', label: 'North channel dredger' },
          ]}></ui-refs>
        </ui-section>
        <ui-section label="Context documents" count="0" limit="0" action="Add a document">
          <ui-refs empty="No documents yet."></ui-refs>
        </ui-section>
      </div>`,
      '420px',
    ),
};
