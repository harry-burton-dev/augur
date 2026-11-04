/**
 * The app runner's wire shapes: app release files, jobs, previews and Admin → Apps' installs
 * (see schemas.ts for how they become the contract).
 */
import Type, { type Static } from 'typebox';
import { APP_JOB_STEPS, type AppRelease as AppReleaseFile } from './store.ts';
import { AppManifestEntry, ref, ServerRing } from './schemas.ts';
import { Change } from './update-schemas.ts';

/** The format an app release file says it is in. */
export const APP_RELEASE_SCHEMA = 'augur.app-release/v1';
const DIGEST_REF = '^[a-z0-9][a-z0-9./:_-]*@sha256:[0-9a-f]{64}$';
const APP_ID = '^[a-z][a-z0-9-]{1,39}$';
const dateTime = (description?: string) => Type.String({ format: 'date-time', ...(description ? { description } : {}) });
const JOB_ACTIONS = ['install', 'remove', 'preview', 'preview-remove'];
const JOB_STATES = ['requested', 'running', 'done', 'failed', 'cancelled'];
const STEP_STATES = ['running', 'done', 'failed'];
const CHANNELS = ['stable', 'beta', 'dev'];
const POLICIES = ['automatic', 'ask', 'hold'];

/** What an app release file must say before the runner is asked to install it. */
export const AppRelease = Type.Unsafe<AppReleaseFile>(Type.Object(
  {
    schema: Type.Literal(APP_RELEASE_SCHEMA),
    id: Type.String({ pattern: APP_ID }),
    version: Type.String({ minLength: 1, maxLength: 40 }),
    channel: Type.Enum(['stable', 'beta', 'dev', 'preview']),
    releasedAt: Type.Optional(Type.String({ maxLength: 40 })),
    sdk: Type.Optional(Type.String({ maxLength: 100 })),
    manifest: ref(AppManifestEntry),
    service: Type.Union([
      Type.Null(),
      Type.Object(
        { image: Type.String({ pattern: DIGEST_REF, maxLength: 300, description: 'The service image by digest, <repo>@sha256:<hex>' }) },
        { additionalProperties: false },
      ),
    ]),
    frontend: Type.Union([
      Type.Null(),
      Type.Object(
        {
          artifact: Type.String({ pattern: DIGEST_REF, maxLength: 300, description: "The frontend's OCI artifact by digest" }),
          digest: Type.String({ pattern: '^sha256:[0-9a-f]{64}$', description: "sha256 of the frontend's tarball" }),
          mediaType: Type.String({ maxLength: 100 }),
        },
        { additionalProperties: false },
      ),
    ]),
    signer: Type.Object(
      {
        repository: Type.String({ pattern: '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' }),
        workflow: Type.String({ pattern: '^\\.github/workflows/[A-Za-z0-9_.-]+\\.ya?ml$' }),
      },
      { additionalProperties: false },
    ),
    asks: Type.Optional(
      Type.Unsafe<Record<string, unknown>>({ type: 'object', description: 'What the version asks an admin for: scopes, storage, floors, maxUpload, settings' }),
    ),
    notes: Type.Optional(Type.String({ maxLength: 20000 })),
    preview: Type.Optional(
      Type.Object(
        { pr: Type.Integer({ minimum: 1 }), title: Type.Optional(Type.String({ maxLength: 300 })), url: Type.Optional(Type.String({ maxLength: 300 })) },
        { additionalProperties: false, description: "For a pull request's build (channel preview, version <x.y.z>-pr.<number>.<run>)" },
      ),
    ),
  },
  {
    $id: 'AppRelease',
    additionalProperties: false,
    description: "An app's release file, app-release.json, as scripts/app-release.mjs writes it (docs/versioning.md, App releases)",
  },
));

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
              changes: Type.Optional(Type.Array(ref(Change))),
            },
            { description: 'The newest release on its channel, when newer than what runs' },
          ),
        ),
        job: Type.Optional(ref(AppJob)),
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
        signer: Type.Object({ repository: Type.Optional(Type.String()), workflow: Type.Optional(Type.String()) }),
        asks: Type.Object({
          scopes: Type.Optional(Type.Array(Type.String())),
          storage: Type.Optional(Type.Unsafe<Record<string, unknown>>({ type: 'object' })),
          maxUpload: Type.Optional(Type.Integer()),
        }),
        problem: Type.Optional(Type.String({ description: "Why it can't open in this AUGUR" })),
        job: Type.Optional(ref(AppJob)),
      }),
    ),
  },
  { $id: 'AppInstalls' },
);

/** What an admin asks the runner to do: install a release (given whole, or from the feed by version), or remove an app. */
export const JobRequest = Type.Unsafe<{ action: 'install'; release: Static<typeof AppRelease> } | { action: 'install'; app: string; version: string } | { action: 'remove'; app: string }>({
  oneOf: [
    Type.Object({ action: Type.Literal('install'), release: ref(AppRelease) }, { additionalProperties: false }),
    Type.Object(
      { action: Type.Literal('install'), app: Type.String({ pattern: APP_ID }), version: Type.String({ minLength: 1, maxLength: 40 }) },
      { additionalProperties: false, description: 'A release from the app feed, by version' },
    ),
    Type.Object({ action: Type.Literal('remove'), app: Type.String({ pattern: APP_ID }) }, { additionalProperties: false }),
  ],
});
