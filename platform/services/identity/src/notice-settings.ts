import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { identifyService, ServiceAuthUnavailable, type ServiceVerifier } from '@augur/service-kit';
import type { AccountSource } from './me.ts';
import type { OrganisationStore } from './organisation.ts';
import { organisationSettings } from './organisation.ts';
import { choice, refused } from './schemas.ts';
import type { PreferenceStore, Preferences } from './store.ts';
import type { WorkspaceStore } from './workspaces.ts';

/**
 * What the events service needs to email a person their notices (ADR 0044, D7): where to send, in
 * which language and time zone, and what they chose in Account → Notifications. Only the events
 * service may ask: it is the one that sends notices, and an address is personal data.
 */
export interface NoticeSettings {
  person: string;
  /** Their address, only once they have confirmed it: nothing is sent to an address they haven't. */
  email?: string;
  /** Their language (the profile's locale), else the deployment's first. */
  language: string;
  /** Their time zone, else the organisation's (ADR 0039, 0042). */
  timeZone: string;
  /** An email for each thing that needs them; on unless they turned it off. */
  emailOn: boolean;
  digest: 'off' | 'daily' | 'weekly';
  quietHours?: { from: string; to: string };
  /** Kinds, as "<app>:<kind>", they set to Quiet. */
  quietKinds: string[];
  /** Apps whose notifications they muted. */
  muted: string[];
}

/** The service allowed to read people's notice settings. */
export const NOTICE_READER = 'events';

/** At most this many people in one ask. */
export const NOTICE_SETTINGS_MAX = 200;

export const settingsFrom = (person: string, prefs: Preferences, profile: { email?: string; emailVerified?: boolean; locale?: string } | undefined, orgTimeZone: string, languages: string[]): NoticeSettings => {
  const n = prefs.notifications ?? {};
  return {
    person,
    ...(profile?.email && profile.emailVerified ? { email: profile.email } : {}),
    language: profile?.locale || languages[0] || 'en',
    timeZone: prefs.timeZone || orgTimeZone,
    emailOn: n.email !== false,
    digest: n.digest ?? 'off',
    ...(n.quietHours ? { quietHours: n.quietHours } : {}),
    quietKinds: prefs.quietKinds ?? [],
    muted: prefs.muted ?? [],
  };
};

const SettingsSchema = Type.Object(
  {
    person: Type.String(),
    email: Type.Optional(Type.String({ description: 'Their confirmed address; absent when they have none or haven’t confirmed it' })),
    language: Type.String({ description: 'Their language, else the deployment’s first' }),
    timeZone: Type.String({ description: 'Their time zone, else the organisation’s' }),
    emailOn: Type.Boolean({ description: 'An email for each thing that needs them' }),
    digest: choice(['off', 'daily', 'weekly']),
    quietHours: Type.Optional(Type.Object({ from: Type.String(), to: Type.String() }, { description: 'HH:MM in their time zone' })),
    quietKinds: Type.Array(Type.String(), { description: 'Kinds, as <app>:<kind>, set to Quiet' }),
    muted: Type.Array(Type.String(), { description: 'Apps they muted' }),
  },
  { $id: 'NoticeSettings', description: 'How a person wants their notices emailed' },
);

export interface NoticeSettingsOptions {
  store: PreferenceStore;
  accounts?: AccountSource;
  workspaces: WorkspaceStore;
  organisation: OrganisationStore;
  verifyService?: ServiceVerifier;
  /** The languages offered, the default first. */
  languages: string[] | (() => Promise<string[]>);
}

export const noticeSettingsRoutes =
  ({ store, accounts, workspaces, organisation, verifyService, languages }: NoticeSettingsOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    app.addSchema(SettingsSchema);
    app.get(
      '/notice-settings',
      {
        schema: {
          summary: "How people want their notices emailed (the events service only)",
          description: [
            'For each person named in ids, or everyone who chose the digest given: their confirmed',
            'address, language, time zone (theirs, else the organisation’s) and choices in Account →',
            'Notifications. A person without an account is left out.',
          ].join(' '),
          querystring: Type.Object({
            ids: Type.Optional(Type.String({ description: `Comma-separated person ids, at most ${NOTICE_SETTINGS_MAX}` })),
            digest: Type.Optional(choice(['daily', 'weekly'])),
          }),
          response: {
            200: Type.Object({ people: Type.Array(Type.Ref('NoticeSettings')) }, { description: 'Their settings' }),
            400: refused('Neither ids nor digest, or too many ids'),
            403: refused('Not the events service'),
            503: refused("The caller's token can't be checked right now"),
          },
        },
      },
      async (req, reply) => {
        try {
          const who = await identifyService(req.headers, verifyService);
          if (who?.kind !== 'platform' || who.name !== NOTICE_READER) return reply.code(403).send({ error: 'forbidden', message: 'Only the events service reads people’s notice settings.' });
        } catch (err) {
          if (!(err instanceof ServiceAuthUnavailable)) throw err;
          return reply.code(503).send({ error: 'unavailable', message: err.message });
        }
        const ids = req.query.ids ? [...new Set(req.query.ids.split(',').map((s) => s.trim()).filter(Boolean))] : undefined;
        if (!ids && !req.query.digest) return reply.code(400).send({ error: 'bad_request', message: 'Name people in ids, or ask for a digest.' });
        if (ids && ids.length > NOTICE_SETTINGS_MAX) return reply.code(400).send({ error: 'bad_request', message: `At most ${NOTICE_SETTINGS_MAX} people at once.` });
        const people = ids ?? (await store.withDigest(req.query.digest!));
        const { timeZone } = await organisationSettings(workspaces, organisation);
        const offered = typeof languages === 'function' ? await languages() : languages;
        const found = await Promise.all(
          people.map(async (person) => {
            const profile = accounts ? await accounts.profile(person).catch(() => undefined) : undefined;
            if (accounts && !profile) return undefined;
            return settingsFrom(person, await store.get(person), profile, timeZone, offered);
          }),
        );
        return { people: found.filter((s): s is NoticeSettings => !!s) };
      },
    );
  };
