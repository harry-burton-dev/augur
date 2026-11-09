/**
 * The app runner's wire shapes: app release files, jobs, previews and Admin → Apps' installs
 * (see schemas.ts for how they become the contract).
 */
import Type, { type Static } from 'typebox';
import { APP_JOB_STEPS, type AppRelease as AppReleaseFile } from './store.ts';
import { ref, ServerRing } from './schemas.ts';
import { Change } from './update-schemas.ts';
import { ReviewSchema } from './apps3.ts';
import { GivenSettings, SettingView } from './settings.ts';

const APP_ID = '^[a-z][a-z0-9-]{1,39}$';
const dateTime = (description?: string) => Type.String({ format: 'date-time', ...(description ? { description } : {}) });
const JOB_ACTIONS = ['install', 'remove', 'preview', 'preview-remove', 'purge'];
const JOB_STATES = ['requested', 'running', 'done', 'failed', 'cancelled'];
const STEP_STATES = ['running', 'done', 'failed'];
const CHANNELS = ['stable', 'beta', 'dev'];
const POLICIES = ['automatic', 'ask', 'hold'];

/**
 * An app's release file, app-release.json, on contract 3 (`augur.app-release/v2`). Its shape is the published
 * schema (@augur/app-tools' app-release-2.schema.json, with the manifest and part schemas it refers to): the
 * registry checks it against that, and the rules beyond it (spec 9.1, 9.2), when it is given one, and answers
 * 400 with the reasons. A v1 file is refused with the contract it speaks.
 */
export const AppRelease = Type.Unsafe<AppReleaseFile>({
  $id: 'AppRelease',
  type: 'object',
  required: ['schema'],
  properties: { schema: { type: 'string', description: 'augur.app-release/v2' } },
  description: "An app's release file, app-release.json, as @augur/app-tools writes it (urn:augur:app-release:2; docs/ship-an-app.md)",
});

export const Preview = Type.Object(
  {
    pr: Type.Integer(),
    version: Type.String(),
    title: Type.Optional(Type.String()),
    url: Type.Optional(Type.String({ description: 'The pull request' })),
    startedAt: dateTime(),
    endsAt: dateTime("When it's taken away unless the pull request is built again"),
  },
  { $id: 'Preview', description: "A pull request's build running beside the app" },
);

export const AppJobStep = Type.Enum([...APP_JOB_STEPS], { $id: 'AppJobStep' });

export const AppJob = Type.Object(
  {
    id: Type.String(),
    app: Type.String(),
    action: Type.Enum(JOB_ACTIONS),
    release: Type.Optional(ref(AppRelease)),
    pr: Type.Optional(Type.Integer({ description: "For a preview's job, its pull request" })),
    upstream: Type.Optional(Type.String({ description: 'For a preview that started, where it answers' })),
    requestedBy: Type.String(),
    requestedAt: dateTime(),
    state: Type.Enum(JOB_STATES),
    steps: Type.Array(
      Type.Object({
        step: ref(AppJobStep),
        state: Type.Enum(STEP_STATES),
        at: dateTime(),
        message: Type.Optional(Type.String()),
      }),
    ),
    message: Type.Optional(Type.String()),
    finishedAt: Type.Optional(dateTime()),
    seenBy: Type.Optional(Type.String({ description: 'Who marked it looked at, once it finished' })),
    seenAt: Type.Optional(dateTime()),
  },
  { $id: 'AppJob' },
);

export const AppInstalls = Type.Object(
  {
    feed: Type.Enum(['on', 'off']),
    checkedAt: Type.Optional(dateTime()),
    problem: Type.Optional(Type.String({ description: "Why the app feed couldn't be read last time" })),
    runnerSeenAt: Type.Optional(dateTime("When the app runner last asked for work; missing when it hasn't since the registry started")),
    sdkVersion: Type.String(),
    ring: Type.Optional(ref(ServerRing)),
    previewsAllowed: Type.Optional(
      Type.Boolean({ description: "Whether pull requests' builds run beside apps for their developers: always on a preview server, with ALLOW_PR_PREVIEWS=on on a production one" }),
    ),
    channelNote: Type.Optional(Type.String({ description: 'Why apps here follow stable only, on a production server' })),
    dataGraceDays: Type.Optional(Type.Integer({ description: 'How long an app removed from the server keeps its data, in days (APP_DATA_GRACE_DAYS)' })),
    removed: Type.Optional(
      Type.Array(
        Type.Object({
          app: Type.String(),
          name: Type.String(),
          removedAt: dateTime(),
          deleteAt: dateTime('When its data goes, unless it is installed again first'),
          failures: Type.Optional(Type.Integer({ description: 'Tries to delete it that failed in a row; each waits longer, up to a day' })),
          problem: Type.Optional(Type.String({ description: 'Why the last try failed' })),
        }),
        { description: 'Apps removed from the server whose data is still kept' },
      ),
    ),
    installed: Type.Array(
      Type.Object({
        app: Type.String(),
        name: Type.String(),
        version: Type.String(),
        installedAt: dateTime(),
        channel: Type.Enum(CHANNELS),
        policy: Type.Enum(POLICIES),
        update: Type.Optional(
          Type.Object(
            {
              version: Type.String(),
              channel: Type.Enum(CHANNELS),
              notesUrl: Type.Optional(Type.String()),
              needs: Type.Array(Type.String(), { description: 'Why it waits for an admin; empty when it can install by itself' }),
              review: Type.Optional(ReviewSchema),
              changes: Type.Optional(Type.Array(ref(Change))),
            },
            { description: 'The newest release on its channel, when newer than what runs' },
          ),
        ),
        job: Type.Optional(ref(AppJob)),
        internet: Type.Optional(
          Type.Object(
            {
              allowed: Type.Boolean(),
              why: Type.Array(Type.String(), { description: 'What each part that asks says it fetches' }),
              hosts: Type.Array(Type.String(), { description: 'The hosts its parts name; any host is reachable once allowed' }),
              allowedBy: Type.Optional(Type.String()),
              allowedAt: Type.Optional(Type.String({ format: 'date-time' })),
            },
            { description: 'For a version that asks for augur-outbound: whether a deployment admin let it reach the internet (off until one does)' },
          ),
        ),
        settings: Type.Optional(
          Type.Array(SettingView, { description: 'Its own settings (contract 3), each with the admin’s value if given; and any a newer version needs first' }),
        ),
        changes: Type.Optional(Type.Array(ref(Change), { description: 'What changed in the version it runs' })),
        older: Type.Optional(
          Type.Array(Type.Object({ version: Type.String(), channel: Type.Enum(['stable', 'beta']) }), {
            description: 'Earlier versions in the feed to go back to (install one; the app is then held there)',
          }),
        ),
        history: Type.Optional(
          Type.Array(
            Type.Object({
              id: Type.String(),
              action: Type.Enum(JOB_ACTIONS),
              version: Type.Optional(Type.String()),
              requestedBy: Type.String({ description: "A person's id, or automatic" }),
              requestedAt: dateTime(),
              state: Type.Enum(JOB_STATES),
              message: Type.Optional(Type.String()),
              finishedAt: Type.Optional(dateTime()),
            }),
            { description: 'Its jobs, newest first (at most 20)' },
          ),
        ),
        developers: Type.Optional(Type.Array(Type.String(), { description: 'Who may try its previews, by person id' })),
        previews: Type.Optional(Type.Array(ref(Preview))),
      }),
    ),
    available: Type.Array(
      Type.Object({
        app: Type.String(),
        name: Type.String(),
        description: Type.Optional(Type.String()),
        version: Type.String(),
        channel: Type.Enum(['stable', 'beta']),
        notesUrl: Type.Optional(Type.String()),
        feed: Type.Optional(Type.String({ description: 'The feed it is listed in, one of APP_FEEDS' })),
        signer: Type.Optional(Type.Object({ repository: Type.Optional(Type.String()), workflow: Type.Optional(Type.String()) })),
        asks: Type.Optional(Type.Object(
          {
            scopes: Type.Array(Type.String()),
            resources: Type.Array(
              Type.Object({ part: Type.String(), type: Type.String(), params: Type.Optional(Type.Unsafe<Record<string, unknown>>({ type: 'object' })) }),
              { description: 'Each resource a part asks for, with its params' },
            ),
            limits: Type.Unsafe<Record<string, { memory: string; cpu: string }>>({
              type: 'object',
              additionalProperties: { type: 'object', properties: { memory: { type: 'string' }, cpu: { type: 'string' } } },
              description: 'By part name',
            }),
            floors: Type.Array(Type.String()),
            maxUpload: Type.Integer(),
            settings: Type.Array(Type.String()),
            canvas: Type.Boolean(),
          },
          { description: "The release's asks, as its file carries them (spec 9.4); missing for one that can't install here" },
        )),
        review: Type.Optional(ReviewSchema),
        problem: Type.Optional(Type.String({ description: "Why it can't open in this AUGUR: for one on contract 2, the only thing said of it" })),
        job: Type.Optional(ref(AppJob)),
      }),
    ),
  },
  { $id: 'AppInstalls' },
);

/** What an admin asks the runner to do: install a release (given whole, or from the feed by version), or remove an app. */
type Given = { settings?: Record<string, string | number | boolean> };
export const JobRequest = Type.Unsafe<({ action: 'install'; release: Static<typeof AppRelease> } & Given) | ({ action: 'install'; app: string; version: string } & Given) | { action: 'remove'; app: string }>({
  oneOf: [
    Type.Object({ action: Type.Literal('install'), release: ref(AppRelease), settings: Type.Optional(GivenSettings) }, { additionalProperties: false }),
    Type.Object(
      { action: Type.Literal('install'), app: Type.String({ pattern: APP_ID }), version: Type.String({ minLength: 1, maxLength: 40 }), settings: Type.Optional(GivenSettings) },
      { additionalProperties: false, description: 'A release from the app feed, by version' },
    ),
    Type.Object({ action: Type.Literal('remove'), app: Type.String({ pattern: APP_ID }) }, { additionalProperties: false }),
  ],
});
