/**
 * The Upgrade Centre's wire shapes: AUGUR's updates and upgrades, each unit's desired state, the
 * overview and reporting (see schemas.ts for how they become the contract).
 */
import Type from 'typebox';
import { MAX_WINDOWS } from './desired-state.ts';
import { UPGRADE_STEPS } from './store.ts';
import { orNull, ref, ServerRing } from './schemas.ts';

const dateTime = (description?: string) => Type.String({ format: 'date-time', ...(description ? { description } : {}) });
/** An object of strings, by any name. */
export const strings = (description?: string) =>
  Type.Unsafe<Record<string, string>>({ type: 'object', additionalProperties: { type: 'string' }, ...(description ? { description } : {}) });
const STATES = ['requested', 'running', 'done', 'rolled-back', 'failed', 'cancelled'];
const STEP_STATES = ['running', 'done', 'failed'];

export const UpgradeStep = Type.Enum([...UPGRADE_STEPS], {
  $id: 'UpgradeStep',
  description: 'watch: the new release is watched for 10 minutes before the upgrade is done (ADR 0020)',
});

export const AfterWatch = Type.Object(
  {
    state: Type.Enum(['watching', 'held', 'failed', 'quiet']),
    since: dateTime(),
    until: dateTime(),
    lastLookAt: Type.Optional(dateTime()),
    calls: Type.Integer(),
    serverErrors: Type.Integer(),
    signInMisses: Type.Integer(),
    message: Type.Optional(Type.String({ description: 'How it ended, in a sentence' })),
    endedAt: Type.Optional(dateTime()),
  },
  { description: 'The light watch after a watch too quiet to judge errors by (ADR 0020, amended)' },
);

export const Upgrade = Type.Object(
  {
    id: Type.String(),
    from: Type.String(),
    version: Type.String(),
    images: strings(),
    requestedBy: Type.String(),
    requestedByName: Type.Optional(Type.String({ description: 'Who asked, by name, as they were signed in then' })),
    requestedAt: dateTime(),
    state: Type.Enum(STATES),
    steps: Type.Array(
      Type.Object({
        step: ref(UpgradeStep),
        state: Type.Enum(STEP_STATES),
        at: dateTime(),
        message: Type.Optional(Type.String()),
      }),
    ),
    message: Type.Optional(Type.String()),
    finishedAt: Type.Optional(dateTime()),
    seenBy: Type.Optional(Type.String({ description: 'Who marked it looked at, once it finished' })),
    seenAt: Type.Optional(dateTime()),
    afterWatch: Type.Optional(AfterWatch),
    settingNames: Type.Optional(Type.Array(Type.String(), { description: 'The names of the settings entered for it; their values are never stored' })),
  },
  { $id: 'Upgrade' },
);

export const PipelineBranch = Type.Enum(['dev', 'preview', 'production'], { $id: 'PipelineBranch' });

export const PipelinePull = Type.Object({ number: Type.Integer(), title: Type.String(), url: Type.String() }, { $id: 'PipelinePull' });

const nullableString = orNull(Type.String());

export const PipelineLine = Type.Object(
  {
    feed: Type.Enum(['on', 'off'], { description: "Off when there's no pipeline feed (a mirror, or PIPELINE_FEED_URL=off)" }),
    checkedAt: Type.Optional(dateTime()),
    problem: Type.Optional(Type.String({ description: 'Why the last read failed; what it read before still shows' })),
    generatedAt: Type.Optional(dateTime()),
    repository: Type.Optional(Type.String()),
    units: Type.Array(
      Type.Object({
        id: Type.String({ description: "augur, or an app's id" }),
        name: Type.String(),
        versions: Type.Object({ dev: nullableString, preview: nullableString, production: nullableString }),
        devBuild: Type.Optional(Type.Object({ version: Type.String(), released: Type.Optional(Type.String()) })),
        waiting: Type.Array(Type.String(), { description: 'The changesets on dev that move it' }),
        previews: Type.Array(Type.Object({ pr: Type.Integer(), version: Type.String() })),
        running: Type.Optional(Type.String({ description: 'The version this server runs, when it runs it' })),
      }),
    ),
    steps: Type.Array(
      Type.Object({
        from: ref(PipelineBranch),
        to: ref(PipelineBranch),
        merged: Type.Integer({ description: "How many pull requests are on from that aren't on to yet" }),
        pulls: Type.Array(Type.Object({ number: Type.Integer(), title: Type.String(), mergedAt: Type.Optional(Type.String()) })),
      }),
    ),
    pulls: Type.Optional(
      Type.Object({
        versionPackages: Type.Optional(ref(PipelinePull)),
        promoteToPreview: Type.Optional(ref(PipelinePull)),
        promoteToProduction: Type.Array(Type.Intersect([ref(PipelinePull), Type.Object({ unit: Type.String(), version: Type.String() })])),
      }),
    ),
  },
  {
    $id: 'PipelineLine',
    description:
      "The Upgrade Centre's line: each unit between dev, preview and production, from the pipeline feed (docs/release-channels.md, The pipeline feed), with what this server runs of it",
  },
);

export const ReleaseChannel = Type.Enum(['stable', 'beta', 'dev'], {
  $id: 'ReleaseChannel',
  description: 'stable is on production, beta on preview, dev a dev build of the dev branch that only the workbench takes (docs/release-channels.md)',
});

export const Halt = Type.Object(
  {
    reason: Type.String(),
    at: Type.Optional(dateTime()),
    by: Type.Optional(Type.String({ description: 'Who halted it' })),
  },
  { $id: 'Halt', description: 'The publisher halted this release (ADR 0018): it is listed but never offered, installed or chosen as next' },
);

export const Change = Type.Object(
  {
    id: Type.Optional(Type.String({ description: "Changesets' commit hash: the same change in two parts has the same id" })),
    kind: Type.Enum(['major', 'minor', 'patch']),
    text: Type.String({ description: "The changeset's words, as Markdown" }),
    parts: Type.Array(Type.String()),
  },
  { $id: 'Change' },
);

export const FeedTrust = Type.Object(
  {
    state: Type.Enum(['verified', 'mirror', 'unchecked'], {
      description: "verified: signed by the publisher and in date; mirror: the organisation's own mirror feed; unchecked: GitHub's releases read directly",
    }),
    expires: Type.Optional(dateTime('When a verified feed stops being good unless it is issued again')),
    issued: Type.Optional(dateTime('When the publisher issued a verified feed; an older one is refused after it')),
    signer: Type.Optional(Type.String({ description: 'The workflow that signed it, as cosign checked it' })),
    note: Type.Optional(Type.String({ description: "What to know when it isn't verified" })),
  },
  { $id: 'FeedTrust', description: 'How far the release feed this server read can be trusted (ADR 0017)' },
);

export const ReleaseSummary = Type.Object(
  {
    version: Type.String(),
    channel: ref(ReleaseChannel),
    released: Type.Optional(Type.String()),
    notesUrl: Type.Optional(Type.String({ format: 'uri' })),
    breaking: Type.Array(Type.String()),
    changes: Type.Optional(Type.Array(ref(Change), { description: 'What changed in it, each change once; absent for a release made before changelogs were attached' })),
    halted: Type.Optional(ref(Halt)),
  },
  { $id: 'ReleaseSummary' },
);

export const UpgradeHistoryEntry = Type.Object(
  {
    id: Type.String(),
    from: Type.String(),
    version: Type.String(),
    requestedBy: Type.String(),
    requestedByName: Type.Optional(Type.String()),
    requestedAt: dateTime(),
    state: Type.Enum(STATES),
    message: Type.Optional(Type.String()),
    finishedAt: Type.Optional(dateTime()),
    backup: Type.Optional(Type.String({ description: 'The backup the updater took first' })),
  },
  { $id: 'UpgradeHistoryEntry' },
);

export const PlatformUpdates = Type.Object(
  {
    running: Type.Object({
      version: Type.String(),
      channel: ref(ReleaseChannel),
      build: Type.Optional(
        Type.Enum(['source'], { description: "Set when the server was built from a checkout (compose.build.yml): version is then the last release it's based on" }),
      ),
    }),
    channel: ref(ReleaseChannel),
    ring: Type.Optional(ref(ServerRing)),
    channelNote: Type.Optional(Type.String({ description: "Why the channel isn't the one RELEASE_CHANNEL asks for (a production server follows stable only)" })),
    feed: Type.Enum(['on', 'off'], { description: 'Off when the deployment set RELEASE_FEED_URL=off' }),
    feedTrust: Type.Optional(ref(FeedTrust)),
    checkedAt: Type.Optional(dateTime()),
    problem: Type.Optional(Type.String({ description: 'Why the last check failed; what it found before still shows' })),
    available: Type.Optional(
      Type.Intersect(
        [
          ref(ReleaseSummary),
          Type.Object({
            parts: Type.Array(Type.Object({ name: Type.String(), from: Type.Optional(Type.String()), to: Type.String() })),
          }),
        ],
        { description: 'The newest release on the channel, when newer than the running one' },
      ),
    ),
    newer: Type.Array(ref(ReleaseSummary), { description: 'Every release on the channel newer than the running one, newest first' }),
    // allOf keeps the description beside the reference: the contract's generator drops a $ref's siblings.
    beta: Type.Optional(Type.Intersect([ref(ReleaseSummary)], { description: 'On stable: a beta newer than anything stable' })),
    next: Type.Optional(Type.String({ description: "The release to upgrade to next; one on the way when the newest can't be reached straight" })),
    upgrade: Type.Optional(Type.Intersect([ref(Upgrade)], { description: "The upgrade asked for, while it's open and for a week after" })),
    history: Type.Optional(Type.Array(ref(UpgradeHistoryEntry), { description: 'Every upgrade asked for, newest first (at most 50)' })),
    goBack: Type.Optional(
      Type.Array(
        Type.Object({
          version: Type.String(),
          channel: ref(ReleaseChannel),
          released: Type.Optional(Type.String()),
          problem: Type.Optional(Type.String({ description: "Why it can't go back straight; absent when it can" })),
          halted: Type.Optional(ref(Halt)),
          breakingAfter: Type.Optional(Type.String({ description: 'The breaking release between, whose backup going back by hand restores' })),
        }),
        { description: 'Earlier releases on the channel to go back to, newest first (at most 5)' },
      ),
    ),
    updaterSeenAt: Type.Optional(dateTime('When the updater last asked for work, since the registry started')),
    portalUrl: Type.Optional(Type.String({ description: "The company's Backstage (PORTAL_URL), which the Upgrade Centre links to" })),
    line: Type.Optional(ref(PipelineLine)),
    needsYou: Type.Array(
      Type.Object({
        kind: Type.Enum(['halted', 'path', 'setting', 'breaking', 'app', 'unknown'], {
          description: 'halted: the running release was halted by its publisher, and is the only need shown',
        }),
        message: Type.String(),
        version: Type.Optional(Type.String()),
        key: Type.Optional(Type.String({ description: 'The setting, for kind setting' })),
        required: Type.Optional(Type.Boolean()),
        madeUp: Type.Optional(Type.Boolean({ description: 'For kind setting: a secret the updater makes up itself' })),
        app: Type.Optional(Type.String({ description: "The app that won't run on the new SDK, for kind app" })),
      }),
    ),
  },
  { $id: 'PlatformUpdates' },
);

export const UpgradeWindow = Type.Object(
  {
    day: Type.Integer({ minimum: 0, maximum: 6, description: '0 is Sunday' }),
    start: Type.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'HH:MM, 24-hour' }),
    hours: Type.Number({ minimum: 1, maximum: 24 }),
  },
  { $id: 'UpgradeWindow', additionalProperties: false, description: "A weekly slot an automatic upgrade may start in, in the unit's time zone" },
);

export const DesiredStateInput = Type.Object(
  {
    channel: Type.Enum(['stable', 'beta', 'dev']),
    policy: Type.Enum(['automatic', 'ask', 'hold'], { description: 'automatic installs what it reaches by itself; ask waits for an admin; hold offers nothing' }),
    automaticUpTo: Type.Enum(['patch', 'minor'], { description: 'How far Automatic goes. A major always waits for an admin.' }),
    pin: Type.Optional(Type.String({ minLength: 1, maxLength: 64, description: 'A semver range the unit stays within, such as 0.13.x' })),
    windows: Type.Array(ref(UpgradeWindow), { maxItems: MAX_WINDOWS, description: 'When an automatic upgrade may start; none means at any time' }),
    timeZone: Type.Optional(Type.String({ minLength: 1, maxLength: 64, description: "An IANA time zone; absent takes the deployment's" })),
  },
  { $id: 'DesiredStateInput', additionalProperties: false },
);

export const DesiredState = Type.Intersect(
  [
    ref(DesiredStateInput),
    Type.Object({
      unit: Type.String(),
      setBy: Type.String({ description: 'Who set it; default for a unit nobody has set' }),
      setAt: dateTime(),
    }),
  ],
  { $id: 'DesiredState' },
);

const REPORTING_MODES = ['send', 'file', 'off'];

export const Reporting = Type.Object(
  {
    mode: Type.Enum(REPORTING_MODES),
    why: Type.String(),
    deployment: Type.Optional(Type.String({ description: "DEPLOYMENT_ID, the deployment's name in Backstage's catalog" })),
    publicKey: Type.Optional(Type.String({ description: 'Base64 SPKI Ed25519 public key' })),
    last: Type.Optional(
      Type.Object({
        at: dateTime(),
        reason: Type.Enum(['started', 'changed', 'heartbeat', 'export']),
        ok: Type.Boolean(),
        problem: Type.Optional(Type.String()),
      }),
    ),
  },
  { $id: 'Reporting' },
);

export const SignedReport = Type.Object(
  {
    deployment: Type.String(),
    payload: Type.String({
      description: "The record as signed: JSON in the format augur.deployment-report/1, with OpAMP's agentDescription, health and packageStatuses",
    }),
    signature: Type.String({ description: "Base64 Ed25519 signature over the payload's UTF-8 bytes" }),
  },
  { $id: 'SignedReport' },
);

const RESULT_KINDS = ['upgrade', 'app-job'];

export const UnitResult = Type.Object(
  {
    kind: Type.Enum(RESULT_KINDS),
    id: Type.String(),
    from: Type.Optional(Type.String()),
    version: Type.Optional(Type.String()),
    state: Type.Enum(['done', 'rolled-back', 'failed', 'cancelled']),
    message: Type.Optional(Type.String()),
    finishedAt: dateTime(),
    seenBy: Type.Optional(Type.String()),
    seenAt: Type.Optional(dateTime()),
  },
  { $id: 'UnitResult' },
);

export const Overview = Type.Object(
  {
    reporting: Type.Optional(
      Type.Object({ mode: Type.Enum(REPORTING_MODES), why: Type.String() }, { description: 'Whether Backstage sees what this server runs (ADR 0019)' }),
    ),
    ring: ref(ServerRing),
    timeZone: Type.String({ description: "The deployment's (DEPLOYMENT_TIME_ZONE)" }),
    feed: Type.Enum(['on', 'off']),
    feedTrust: Type.Optional(ref(FeedTrust)),
    checkedAt: Type.Optional(dateTime()),
    units: Type.Array(
      Type.Object({
        unit: Type.String({ description: "augur, or an app's id" }),
        name: Type.String(),
        running: Type.String(),
        available: Type.Optional(Type.String({ description: 'The newest release on its channel, when newer' })),
        halted: Type.Optional(ref(Halt)),
        desired: Type.Intersect([
          ref(DesiredState),
          Type.Object({
            timeZone: Type.String(),
            isDefault: Type.Boolean({ description: 'Nobody has set it; these are the defaults' }),
          }),
        ]),
        policy: Type.String({ description: 'The record in a sentence' }),
        window: Type.Object({ open: Type.Boolean(), nextAt: Type.Optional(dateTime()) }),
        automatic: Type.Optional(
          Type.Object(
            { takes: Type.Optional(Type.String()), waits: Type.Optional(Type.String()) },
            { description: 'What Automatic does with the next release: takes it, or why it waits' },
          ),
        ),
        open: Type.Optional(Type.Object({ id: Type.String(), version: Type.Optional(Type.String()), state: Type.Enum(['requested', 'running']) })),
        lastResult: Type.Optional(ref(UnitResult)),
      }),
    ),
    needsYou: Type.Array(
      Type.Object({
        kind: Type.Enum(['halted', 'failed', 'went-back', 'first-upgrade', 'after-watch']),
        unit: Type.String(),
        message: Type.String(),
        result: Type.Optional(Type.Object({ kind: Type.Enum(RESULT_KINDS), id: Type.String() }, { description: 'The result to mark looked at' })),
      }),
    ),
    you: Type.Optional(
      Type.Object(
        { deploymentAdmin: Type.Boolean({ description: 'Whether the caller holds deployment-admin, which upgrading, going back and changing settings need (ADR 0022, 0084)' }) },
        { description: 'What the caller may do here, for a frontend that is never told their roles (contract 3). Absent in what Backstage is sent' },
      ),
    ),
  },
  { $id: 'Overview' },
);
