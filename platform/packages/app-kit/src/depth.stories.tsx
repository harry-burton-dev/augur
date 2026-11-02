import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Icon, Segmented } from '@augur/kit-common';
import { AppFrame, RailLink } from './app-frame.js';
import { FocusField, FocusItem, type Ambience, type Depth } from './focus.js';
import { FrontPage, frontSections, type FrontPageConfig } from './front-page.js';
import { Palette, type PaletteItem } from './palette.js';
import { PathTree, type PathLight, type PathNode } from './path-tree.js';
import type { RingAction, RingShape, RingSubject } from './radial-menu.js';
import type { ReelItem, Reveal } from './reel.js';
import { AddTile, KindTile, Tiles } from './tiles.js';

/** A small library of plans, to walk through. */
const TREE: PathNode[] = [
  {
    id: 'north',
    label: 'Northern region',
    icon: 'library',
    count: 4,
    children: [
      { id: 'sites', label: 'Sites', icon: 'folder', count: 2, children: [] },
      { id: 'people', label: 'People', icon: 'folder', count: 3, children: [] },
      { id: 'weekly', label: 'Weekly updates', icon: 'series', count: 5, children: [] },
    ],
  },
  { id: 'south', label: 'Southern region', icon: 'library', count: 1, children: [] },
  { id: 'ref', label: 'Reference', icon: 'library', count: 1, children: [] },
];

const actionsFor = (name: string, full: boolean): RingAction[] => [
  { id: 'open', label: 'Open', icon: 'arrow' },
  { id: 'rename', label: 'Rename', icon: 'rename' },
  { id: 'share', label: 'Share', icon: 'people' },
  { id: 'publish', label: 'Publish up', icon: 'publish', disabled: true, reason: 'Only the floor’s leads can publish it' },
  { id: 'archive', label: 'Archive', icon: 'archive' },
  { id: 'delete', label: 'Delete', icon: 'delete', danger: true, disabled: full, reason: full ? `Empty ${name} first` : undefined },
];

const art = (kind: 'sign' | 'review' | 'read') => (
  <>
    <Icon name="document" size={36} />
    <Icon name={kind === 'sign' ? 'rename' : kind === 'review' ? 'check' : 'info'} size={18} />
  </>
);

const FRONT: FrontPageConfig = {
  look: 'title',
  sections: [
    { id: 'actions', title: 'Actions', empty: 'Nothing needs you.', layout: 'reel', tone: 'action', reveal: 'pull', noun: 'action' },
    { id: 'new', title: 'New', empty: 'Nothing new since you looked.', layout: 'reel', tone: 'new', reveal: 'pull', noun: 'new document' },
    { id: 'upcoming', title: 'Upcoming', empty: 'Nothing coming up this week.', layout: 'reel', tone: 'upcoming', reveal: 'all', noun: 'upcoming item' },
  ],
};

interface Knobs {
  depth: Depth;
  ambience: Ambience;
  reveal: Reveal;
  light: PathLight;
  ringShape: RingShape;
}

function Example({ depth, ambience, reveal, light, ringShape }: Knobs) {
  const [path, setPath] = useState<string[]>([]);
  const [said, setSaid] = useState('Right-click anything, or the space between.');
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setFinding(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const ring = (node: { id: string; label: string }, full = false): RingSubject => ({
    label: node.label,
    actions: actionsFor(node.label, full),
    onAction: (id) => (id === 'delete' ? setConfirm(true) : id === 'open' ? open(node.id) : setSaid(`${id} ${node.label}`)),
  });
  const open = (id: string) => setPath(id === 'north' ? ['north'] : ['north', id].filter((x, i, a) => a.indexOf(x) === i));
  const reel = (items: [string, string, string, boolean?][], kind: 'sign' | 'review' | 'read'): ReelItem[] =>
    items.map(([id, title, when, urgent]) => ({
      id,
      title,
      when,
      urgent,
      art: art(kind),
      onOpen: () => setSaid(`Opened ${title}`),
      ring: () => ({ label: title, actions: [{ id: 'open', label: 'Open', icon: 'arrow' }, { id: 'done', label: 'Done', icon: 'check' }, { id: 'later', label: 'Later', icon: 'clock' }], onAction: (a) => setSaid(`${a}: ${title}`) }),
    }));
  const sections = frontSections(
    { ...FRONT, sections: FRONT.sections.map((s) => (s.layout === 'reel' && s.id !== 'upcoming' ? { ...s, reveal } : s)) },
    {
      actions: { items: reel([['a1', 'Sign off Joining', 'Late', true], ['a2', 'Review site plan', 'Today 12:00', true], ['a3', 'Approve budget update', 'Today 15:00', true], ['a4', 'Approve leave guidance', 'Thu'], ['a5', 'Reply on code of conduct', 'Thu']], 'sign') },
      new: { items: reel([['n1', 'Read the information sheet update', 'Thu'], ['n2', 'Read the policy refresh', 'Fri'], ['n3', 'Read handover notes', 'Mon']], 'read') },
      upcoming: { items: reel([['u1', 'Check daily orders', 'Thu 08:30'], ['u2', 'Add this week’s update', 'Fri 12:00'], ['u3', 'Check contacts', 'Fri 16:00']], 'review') },
    },
  );
  const here = TREE[0]!;
  const results: PaletteItem[] = useMemo(() => {
    const all = [here, ...here.children!, TREE[1]!, TREE[2]!];
    const term = query.trim().toLowerCase();
    return all.filter((n) => !term || n.label.toLowerCase().includes(term)).map((n, i) => ({ id: n.id, label: n.label, icon: n.icon, detail: 'Plans', meta: n.children ? 'Folder' : '', group: i === 0 ? (term ? 'Found' : 'Recent') : undefined }));
  }, [query, here]);

  return (
    <div style={{ height: '100vh' }}>
      <AppFrame
        app={{ name: 'Plans', icon: 'library' }}
        onFront={() => setPath([])}
        screen={path.join('/') || 'front'}
        depth={depth}
        ringShape={ringShape}
        railLabel="Plans"
        rail={
          <>
            <RailLink icon="folder" label="Your collections" count={3} current={path.length > 0} onPress={() => open('north')} />
            {path.length ? <PathTree label="Your collections" nodes={TREE} path={path} onOpen={(n) => open(n.id)} ringFor={(n) => ring(n, Boolean(n.count))} light={light} /> : null}
            <RailLink icon="people" label="Shared libraries" count={4} onPress={() => setSaid('Shared libraries')} />
          </>
        }
      >
        {path.length === 0 ? (
          <FrontPage
            eyebrow="Your floor"
            heading="Plans"
            look="title"
            ambience={ambience}
            search={
              <Button kind="secondary" onPress={() => setFinding(true)}>
                Find a plan, folder or library ( / )
              </Button>
            }
            sections={sections}
          />
        ) : (
          <>
            <h1 className="text-title-s">{path.length === 1 ? here.label : here.children!.find((c) => c.id === path[1])?.label}</h1>
            <Tiles label="Here" ring={() => ({ label: here.label, actions: [{ id: 'new-folder', label: 'New folder', icon: 'folder-plus' }, { id: 'add', label: 'Add files', icon: 'upload' }, { id: 'sort', label: 'Sort', icon: 'sort' }], onAction: (a) => setSaid(a) })}>
              <KindTile kind="folder" eyebrow="Folder" name="Sites" count="02" onOpen={() => open('sites')} ring={() => ring({ id: 'sites', label: 'Sites' }, true)} />
              <KindTile kind="folder" eyebrow="Folder" name="People" count="03" onOpen={() => open('people')} ring={() => ring({ id: 'people', label: 'People' }, true)} />
              <KindTile kind="document" eyebrow="Document" name="Site index" count="v2" state="In review" needs needsLabel="Needs your review" onOpen={() => setSaid('Site index')} ring={() => ring({ id: 'index', label: 'Site index' })} />
              <KindTile kind="series" eyebrow="Series" name="Weekly updates" count="05" onOpen={() => open('weekly')} ring={() => ring({ id: 'weekly', label: 'Weekly updates' }, true)} />
              <KindTile kind="library" eyebrow="Library" name="Southern library" owner="Southern region" locked="Shared with the southern region only. Its leads can add you." onOpen={() => setSaid('Locked')} />
              <AddTile label="Add here" onPress={() => setSaid('Add here')} />
            </Tiles>
          </>
        )}
        <p className="text-meta text-ink-muted" aria-live="polite">
          {said}
        </p>
      </AppFrame>
      <Palette
        open={finding}
        onClose={() => {
          setFinding(false);
          setQuery('');
        }}
        placeholder="Find a plan, folder or library"
        query={query}
        onQuery={setQuery}
        items={results}
        onPick={(item) => {
          setFinding(false);
          open(item.id);
        }}
      />
      <Dialog open={confirm} onClose={() => setConfirm(false)} heading="Delete it?" summary="The app racks out of focus behind this dialog, rather than going black." actionLabel="Delete" danger />
    </div>
  );
}

const meta = {
  title: 'Quill/Depth and focus',
  component: Example,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    depth: { control: 'inline-radio', options: ['veil', 'lens', 'scrim'] },
    ambience: { control: 'inline-radio', options: ['soft', 'quiet'] },
    reveal: { control: 'inline-radio', options: ['pull', 'all'] },
    light: { control: 'inline-radio', options: ['path', 'flat'] },
    ringShape: { control: 'inline-radio', options: ['auto', 'ring', 'list'] },
  },
  args: { depth: 'veil', ambience: 'soft', reveal: 'pull', light: 'path', ringShape: 'auto' },
} satisfies Meta<typeof Example>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A whole app: the title front page with reels, the lit path, tiles, the radial menu, the palette ( / ) and a dialog. */
export const App: Story = {};

/** The other way of each choice, one control away: depth `lens` or `scrim`, ambience `quiet`, reveal `all`, light `flat`, ring `list`. */
export const Alternatives: Story = { args: { depth: 'lens', ambience: 'quiet', reveal: 'all', light: 'flat', ringShape: 'list' } };

function FocusPullExample() {
    const [pulled, setPulled] = useState(true);
    const [ambience, setAmbience] = useState<Ambience>('soft');
    return (
      <div className="flex flex-col gap-5">
        <div className="flex gap-4">
          <Button kind="secondary" onPress={() => setPulled(!pulled)}>
            {pulled ? 'Let go' : 'Pull focus'}
          </Button>
          <Segmented label="Ambience" value={ambience} onChange={(v) => setAmbience(v as Ambience)} options={[{ value: 'soft', label: 'Soft' }, { value: 'quiet', label: 'Quiet' }]} />
        </div>
        <FocusField pulled={pulled} ambience={ambience} className="flex gap-4">
          <FocusItem className="p-4 rounded-inset bg-surface-raised">A document you read last week</FocusItem>
          <FocusItem pulled className="p-4 rounded-inset bg-surface-raised">Approve the budget today</FocusItem>
          <FocusItem className="p-4 rounded-inset bg-surface-raised">A minor notice</FocusItem>
        </FocusField>
      </div>
    );
}

/** Focus pull on its own: one thing needs action, the rest step back. */
export const FocusPull: StoryObj = { render: () => <FocusPullExample /> };
