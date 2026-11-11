import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import type { CatalogueApp, FeaturePreviewMode, FloorChoice } from './api.js';
import { appEyebrow, appStatus, FLOOR_CHOICES, floorStatus, floorTree, inboxWords, kindWords, refusedKindNote, scopeWords, shipsWithAugur, uploadChoices } from './apps-model.js';
import { said, waiting } from './common.js';
import { featureHint, featureModeChoices } from './installs.js';
import { day } from './parts.js';
import { quill } from './quill.js';
import { pathOf } from './routes.js';
import type { View } from './view.js';

/** The intent Deployment handles to open an app's page there: what the server runs for it (ADR 0030). */
export const DEPLOYMENT_APP = 'deployment.app.open';
/** Deployment's id in the catalogue, where its name comes from. */
const DEPLOYMENT = 'upgrades';

/** What Deployment is called on this deployment. */
const deploymentName = (v: View) => v.r.apps.value?.find((a) => a.id === DEPLOYMENT)?.name ?? 'Deployment';

/** Every app in the catalogue, with its version and where it stands. Each opens its own page. */
export const appsPage = (v: View): RemoteNode => {
  const wait = waiting([v.r.apps], 'Reading the app catalogue');
  if (wait) return wait;
  const rows = v.r.apps.value!.map((a) => ({
    id: a.id,
    name: a.name,
    version: a.pinnedVersion ? `${a.version}, held` : a.version,
    route: a.route,
    state: appStatus(a).label,
    kind: kindWords(a).label,
    source: a.platform || shipsWithAugur(a) ? 'AUGUR' : (a.registeredBy ?? ''),
  }));
  const deployment = deploymentName(v);
  return [
    quill('quill-notice', { tone: 'info', action: `Open ${deployment}`, onAction: () => void v.on.open() }, `Turn an app off here to stop offering it, without removing it. Installing, rolling back and what the server runs for each app are in ${deployment}.`),
    quill('quill-table', {
      label: 'Apps',
      noun: 'apps',
      filterable: true,
      pageSize: 25,
      columns: [
        { key: 'name', label: 'App', sortable: true },
        { key: 'version', label: 'Version', sortable: true },
        { key: 'route', label: 'Address', sortable: true },
        { key: 'state', label: 'Status', sortable: true },
        { key: 'kind', label: 'Kind', sortable: true },
        { key: 'source', label: 'From', sortable: true },
      ],
      rows,
      empty: 'No apps are registered.',
      onOpen: (id: string) => v.on.go(pathOf({ page: 'app', id })),
    }),
    said(v, 'deployment'),
  ];
};

/**
 * One app, on a page of its own: what it is, whether it's offered, what it may do, its upload limit, its own
 * settings and feature previews, and where it's on, floor by floor. Each choice saves as it changes.
 */
export const appPage = (v: View, id: string): RemoteNode => {
  const wait = waiting([v.r.apps], 'Reading the app catalogue');
  if (wait) return wait;
  const app = v.r.apps.value!.find((a) => a.id === id);
  if (!app) return quill('quill-state', { kind: 'empty', heading: `Nothing called “${id}” is in the catalogue`, action: 'See every app', size: 'page', onAction: () => v.on.go(pathOf({ page: 'apps' })) });
  const ships = shipsWithAugur(app);
  const shipped = app.platform || ships;
  const s = appStatus(app);
  const inbox = inboxWords(app);
  const refused = refusedKindNote(app);
  const took = (where: string, call: () => Promise<CatalogueApp>) =>
    v.on.act(where, async () => {
      const next = await call();
      v.on.put('apps', (v.r.apps.value ?? []).map((a) => (a.id === next.id ? next : a)));
    });
  const deployment = deploymentName(v);
  return [
    quill('quill-details', {
      items: [
        { label: 'Kind', value: kindWords(app).fact, note: appEyebrow(app) },
        { label: 'Version', value: app.pinnedVersion ? `${app.version}, held` : app.version },
        { label: 'AUGUR SDK', value: app.sdk },
        { label: 'Address', value: app.route },
        ...(app.entry.startsWith('/') && !app.entry.startsWith('//') ? [] : [{ label: 'Loads from', value: app.entry }]),
        ...(app.requiredRole ? [{ label: 'Only for', value: app.requiredRole }] : []),
        ...(app.platform ? [] : [{ label: 'May', value: scopeWords(app.grantedScopes ?? app.scopes) }]),
        ...(inbox ? [{ label: 'Inbox work', value: inbox }] : []),
        ...(app.handles?.length ? [{ label: 'Answers', value: app.handles.join(', ') }] : []),
        ...(app.updatedAt ? [{ label: 'Registered', value: day(app.registeredAt), note: `Last updated ${day(app.updatedAt)}` }] : []),
      ],
      limit: 0,
    }),
    app.description ? quill('quill-notice', { tone: 'info' }, app.description) : null,
    refused ? quill('quill-notice', { tone: 'warning' }, refused) : null,
    quill('quill-section', { label: 'Offered to people' }, [
      app.platform
        ? quill('quill-notice', { tone: 'info' }, 'Built-in apps are always on.')
        : [
            quill('quill-notice', { tone: app.enabled && !s.why ? 'info' : 'warning' }, app.enabled ? (s.why ?? 'Offered to people: everyone it’s meant for sees it in Apps and Title.') : 'Turned off: nobody is offered it. Nothing of its data is removed.'),
            app.enabled
              ? quill('quill-ask-twice', { label: 'Turn it off', confirm: 'Press again: nobody is offered it from now', size: 'sm', onPress: () => took('offered', () => v.api.setAppEnabled(app.id, false)) })
              : quill('quill-button', { label: 'Offer it to people', kind: 'secondary', size: 'sm', onPress: () => took('offered', () => v.api.setAppEnabled(app.id, true)) }),
          ],
      app.awaitingScopes?.length
        ? quill(
            'quill-notice',
            { tone: 'needs', heading: `Version ${app.version} also asks to: ${scopeWords(app.awaitingScopes)}`, action: 'Allow it', onAction: () => took('offered', () => v.api.grantScopes(app.id, [...(app.grantedScopes ?? []), ...(app.awaitingScopes ?? [])])) },
            'It runs without that until you allow it.',
          )
        : null,
      app.platform
        ? null
        : quill('quill-select', {
            label: 'Largest upload',
            hint: 'What one request to its service may carry. You can lower what it asks for, not raise it.',
            options: uploadChoices(app),
            value: app.uploadLimitLowered ? String(app.uploadLimit) : 'asked',
            onChange: (x: string) => took('offered', () => v.api.limitUploads(app.id, x === 'asked' ? null : Number(x))),
          }),
      said(v, 'offered'),
    ]),
    app.platform ? null : settingsSection(v, app),
    app.platform ? null : previewsSection(v, app),
    app.platform ? null : floorsSection(v, app),
    quill('quill-section', { label: 'On the server' }, [
      quill(
        'quill-notice',
        { tone: 'info', ...(shipped ? {} : { action: `Open it in ${deployment}`, onAction: () => void v.on.open(app.id) }) },
        shipped
          ? 'It ships with AUGUR and changes version with it. Turn it off here or floor by floor; it can’t be removed, and its sign-in is in the server’s settings.'
          : `Its versions, rolling it back, its sign-in, its internet, settings on the server, developers and removing it are in ${deployment}.`,
      ),
      said(v, 'deployment'),
    ]),
  ];
};

/** The settings the app offers, each a whole number, saved when the field is left. */
const settingsSection = (v: View, app: CatalogueApp): RemoteNode => {
  if (!app.settings?.length) return null;
  const slot = v.r.settings(app.id);
  return quill('quill-section', { label: 'Its settings' }, [
    waiting([slot], 'Reading its settings', 'region') ??
      slot.value!.map((s) =>
        quill('quill-text-field', {
          label: s.unit ? `${s.label} (${s.unit})` : s.label,
          hint: [s.detail, `${s.min} to ${s.max}; ${s.default} unless you change it.`].filter(Boolean).join(' '),
          value: String(s.value),
          onCommit: (typed: string) => {
            const value = typed.trim() === '' ? null : Number(typed);
            if (value !== null && (!Number.isInteger(value) || value < s.min || value > s.max)) {
              v.ui.problem = { where: 'settings', words: `${s.label} is a whole number from ${s.min} to ${s.max}${s.unit ? ` ${s.unit}` : ''}.` };
              return v.on.draw();
            }
            if (value === s.value) return;
            v.on.act('settings', async () => v.on.putApp('settings', app.id, await v.api.setAppSetting(app.id, s.id, value)));
          },
        }),
      ),
    said(v, 'settings'),
  ]);
};

/** The features the app is trying, each with who gets it, down to chosen floors (ADR 0021, amended). */
const previewsSection = (v: View, app: CatalogueApp): RemoteNode => {
  if (!app.previews?.length) return null;
  const slot = v.r.previews(app.id);
  const features = slot.value;
  const picking = v.ui.draft.picking;
  const wantsFloors = Boolean(picking || features?.previews.some((p) => p.mode === 'floors'));
  const floors = wantsFloors && v.r.floor.value && v.r.departments.value ? floorTree(v.r.floor.value, v.r.departments.value) : undefined;
  const names = new Map((floors ?? []).map((f) => [f.id, f.name]));
  const floorName = (fid: string) => names.get(fid) ?? 'a floor that’s gone';
  const save = (preview: string, mode: FeaturePreviewMode | null, chosen?: string[]) =>
    v.on.act('previews', async () => {
      v.on.putApp('previews', app.id, await v.api.setFeaturePreview(app.id, preview, mode, chosen));
      v.ui.draft.picking = undefined;
    });
  return quill('quill-section', { label: 'Feature previews' }, [
    quill('quill-notice', { tone: 'info' }, 'Features it’s trying before they’re everyone’s. Turn one on for chosen floors to try it there first; people turn the opt-in ones on for themselves in the shell’s Previews.'),
    waiting([slot], 'Reading its previews', 'region') ??
      features!.previews.map((p) => {
        const onFloors = picking === p.id || (p.chosen && p.mode === 'floors');
        return [
          quill('quill-select', {
            label: p.name,
            hint: featureHint(p, floorName),
            options: featureModeChoices(p, features!.defaultMode),
            value: picking === p.id ? 'floors' : p.chosen ? p.mode : 'default',
            onChange: (x: string) => {
              if (x === 'floors') {
                v.ui.draft.picking = p.id;
                return v.on.draw();
              }
              if (picking === p.id) v.ui.draft.picking = undefined;
              save(p.id, x === 'default' ? null : (x as FeaturePreviewMode));
            },
          }),
          onFloors
            ? quill('quill-tag-picker', {
                label: 'On for these floors',
                hint: picking === p.id ? 'Choose at least one: it’s saved once you do. The floors beneath each have it too.' : 'The floors beneath each have it too. To turn it off everywhere, choose Off above.',
                placeholder: floors ? 'Type a floor’s name' : 'Listing the floors…',
                ...(floors ? {} : { disabled: true, reason: 'The floors are still being listed.' }),
                options: (floors ?? []).map((f) => ({ value: f.id, label: f.name, ...(f.path.length > 2 ? { detail: f.path.slice(1, -1).map(floorName).join(' › ') } : {}) })),
                value: picking === p.id ? [] : (p.floors ?? []),
                onChange: (ids: string[]) => {
                  if (ids.length) return save(p.id, 'floors', ids);
                  v.ui.problem = { where: 'previews', words: `${p.name} needs at least one floor. To turn it off everywhere, choose Off.` };
                  v.on.draw();
                },
              })
            : null,
        ];
      }),
    said(v, 'previews'),
  ]);
};

/** Where the app is on, floor by floor, and a choice for each. Everyone's own floor follows the org. */
const floorsSection = (v: View, app: CatalogueApp): RemoteNode => {
  const rules = v.r.floors(app.id);
  const { floor, departments } = v.r;
  const wait = waiting([rules, floor, departments], 'Reading where it’s on', 'region');
  const list = wait ? [] : floorTree(floor.value!, departments.value!);
  const names = new Map(list.map((f) => [f.id, f.name]));
  return quill('quill-section', { label: 'Where it’s on' }, [
    quill('quill-notice', { tone: 'info' }, 'Each floor follows the one above unless you choose. Everyone’s own floor follows the org.'),
    wait ??
      list.map((f) =>
        quill('quill-select', {
          label: f.path.length > 1 ? `${f.path.slice(1, -1).map((x) => `${names.get(x) ?? ''} › `).join('')}${f.name}` : f.name,
          hint: floorStatus(app, f, rules.value!, names).words,
          options: FLOOR_CHOICES,
          value: rules.value!.find((r) => r.workspace === f.id)?.state ?? 'inherit',
          onChange: (x: string) => v.on.act('floors', async () => v.on.putApp('floors', app.id, (await v.api.setAppFloor(app.id, f.id, x as FloorChoice)).rules)),
        }),
      ),
    said(v, 'floors'),
  ]);
};
