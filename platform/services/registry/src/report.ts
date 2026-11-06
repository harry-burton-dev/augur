// What this deployment runs, reported to the company's Backstage (ADR 0019): a record signed with the
// deployment's own key, sent after each change and at least every 15 minutes (ADR 0059: Backstage raises
// the alarm when one is late), or exported as a file for an air-gapped
// deployment. The record's shapes follow OpAMP's AgentToServer status messages (agent description,
// health, package statuses), so a standard OpAMP server could take over later. It holds no personal data:
// no names, no ids of people, nothing about what anyone keeps in AUGUR.
import { callerFromHeaders } from '@augur/service-kit';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ref, refused } from './schemas.ts';
import { Reporting as ReportingSchema, SignedReport } from './update-schemas.ts';
import type { Overview } from './overview.ts';
import type { AppStore, DeploymentKey } from './store.ts';

export const REPORT_FORMAT = 'augur.deployment-report/1';
/** A deployment's name in Backstage's catalog (org/deployments.yaml), as DEPLOYMENT_ID gives it. */
const DEPLOYMENT_NAME = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
/**
 * How often a record goes even when nothing changed (ADR 0059). Backstage raises the alarm when one is
 * more than 30 minutes late, so one missed send isn't an alarm and two are.
 */
export const HEARTBEAT_MS = 15 * 60_000;
/** How often the sender looks for a change to report: a little more often than the heartbeat, so it's never late. */
const LOOK_MS = 5 * 60_000;
/** Time for the registry to settle after it starts, as after an upgrade, before it reports. */
const FIRST_MS = 2 * 60_000;
const SEND_TIMEOUT_MS = 15_000;

export type ReportReason = 'started' | 'changed' | 'heartbeat' | 'export';

/** Whether and where this deployment reports, from .env. */
export interface Reporting {
  /** send: to Backstage and as a file; file: as a file only; off: neither. */
  mode: 'send' | 'file' | 'off';
  /** Why it is in that mode, in a sentence an admin can act on. */
  why: string;
  deployment?: string;
  /** Where records are sent. */
  url?: string;
}

/**
 * DEPLOYMENT_REPORTING=off turns reporting off. Otherwise a deployment with DEPLOYMENT_ID reports: to
 * PORTAL_URL's Backstage when that's set, else as a file only (an air-gapped one).
 */
export function reportingFrom(env: { DEPLOYMENT_ID?: string; DEPLOYMENT_REPORTING?: string; PORTAL_URL?: string }): Reporting {
  const setting = env.DEPLOYMENT_REPORTING || 'on';
  if (setting !== 'on' && setting !== 'off') throw new Error(`DEPLOYMENT_REPORTING is on or off, not "${setting}".`);
  const deployment = env.DEPLOYMENT_ID || undefined;
  if (deployment && !DEPLOYMENT_NAME.test(deployment)) throw new Error(`DEPLOYMENT_ID is this deployment's name in Backstage's catalog, such as augur-workbench: lower case letters, digits and dashes, not "${deployment}".`);
  if (setting === 'off') return { mode: 'off', why: 'Reporting is off: DEPLOYMENT_REPORTING=off in .env. Backstage doesn’t see what this server runs.' };
  if (!deployment) return { mode: 'off', why: 'Reporting isn’t set up: set DEPLOYMENT_ID in .env to this server’s name in Backstage (org/deployments.yaml).' };
  const portal = env.PORTAL_URL?.replace(/\/+$/, '');
  if (!portal) return { mode: 'file', deployment, why: 'No PORTAL_URL in .env, so nothing is sent: export the record and carry it to Backstage.' };
  return { mode: 'send', deployment, url: `${portal}/api/augur/reports`, why: `Sent to Backstage after each change and every 15 minutes.` };
}

/** The deployment's key, made the first time it's needed and kept with its data. */
export async function deploymentKey(store: AppStore): Promise<DeploymentKey> {
  const kept = await store.deploymentKey();
  if (kept) return kept;
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return store.keepDeploymentKey({
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  });
}

/** The public key as one line, for the augur.dev/report-key annotation in Backstage's catalog. */
export const publicKeyLine = (key: DeploymentKey) => createPublicKey(key.publicKey).export({ format: 'der', type: 'spki' }).toString('base64');

const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });

/** The record of what this deployment runs, from the Upgrade Centre's overview. Pure, for tests. */
export function reportOf(overview: Overview, { deployment, reason, now }: { deployment: string; reason: ReportReason; now: Date }) {
  const needs = overview.needsYou;
  const healthOf = (unit: string) => {
    const need = needs.find((n) => n.unit === unit);
    return need ? { healthy: false, status: need.message } : { healthy: true, status: 'Runs as it should.' };
  };
  const augur = overview.units.find((u) => u.unit === 'augur');
  return {
    format: REPORT_FORMAT,
    deployment,
    sentAt: now.toISOString(),
    reason,
    ring: overview.ring,
    agentDescription: {
      identifyingAttributes: [attr('service.name', 'augur'), attr('service.instance.id', deployment), ...(augur ? [attr('service.version', augur.running)] : [])],
      nonIdentifyingAttributes: [attr('deployment.environment.name', overview.ring), attr('augur.time_zone', overview.timeZone)],
    },
    health: {
      healthy: needs.length === 0,
      status: needs.length ? needs.map((n) => n.message).join(' ') : 'Everything runs as it should.',
      componentHealthMap: Object.fromEntries(overview.units.map((u) => [u.unit, healthOf(u.unit)])),
    },
    packageStatuses: {
      packages: Object.fromEntries(
        overview.units.map((u) => [
          u.unit,
          {
            name: u.unit,
            agentHasVersion: u.running,
            ...(u.available ? { serverOfferedVersion: u.available } : {}),
            status: u.open ? 'installing' : u.lastResult?.state === 'failed' ? 'install-failed' : 'installed',
            ...(u.lastResult?.state === 'failed' && u.lastResult.message ? { errorMessage: u.lastResult.message } : {}),
          },
        ]),
      ),
    },
    units: overview.units.map((u) => ({
      unit: u.unit,
      name: u.name,
      running: u.running,
      ...(u.available ? { available: u.available } : {}),
      ...(u.halted ? { halted: { reason: u.halted.reason } } : {}),
      channel: u.desired.channel,
      policy: u.policy,
      ...(u.desired.pin ? { pin: u.desired.pin } : {}),
      ...(u.open ? { open: { ...(u.open.version ? { version: u.open.version } : {}), state: u.open.state } } : {}),
      // Who looked at a result is a person, so it stays here.
      ...(u.lastResult
        ? { lastResult: { state: u.lastResult.state, ...(u.lastResult.from ? { from: u.lastResult.from } : {}), ...(u.lastResult.version ? { version: u.lastResult.version } : {}), finishedAt: u.lastResult.finishedAt, ...(u.lastResult.message ? { message: u.lastResult.message } : {}) } }
        : {}),
    })),
    feed: { state: overview.feed, ...(overview.feedTrust ? { trust: overview.feedTrust } : {}), ...(overview.checkedAt ? { checkedAt: overview.checkedAt } : {}) },
  };
}

export type Report = ReturnType<typeof reportOf>;

/** The record as Backstage takes it, and as an exported file holds it: the exact bytes signed, and the signature. */
export const signReport = (report: Report, key: DeploymentKey) => {
  const payload = JSON.stringify(report);
  return { deployment: report.deployment, payload, signature: sign(null, Buffer.from(payload, 'utf8'), createPrivateKey(key.privateKey)).toString('base64') };
};

/** What changed enough to report: the versions, what's available, what's under way, the last results and needs. */
export const fingerprint = (report: Report) =>
  createHash('sha256')
    .update(JSON.stringify([report.units, report.health.healthy, report.feed.state]))
    .digest('hex');

export interface LastSend {
  at: string;
  reason: ReportReason;
  ok: boolean;
  problem?: string;
}

/** Sends the record when the registry starts (as after an upgrade), when something changes, and every 15 minutes. */
export class ReportSender {
  last?: LastSend;
  private sentPrint?: string;
  private sentAt = 0;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly opts: {
      reporting: Reporting;
      store: AppStore;
      overview: () => Promise<Overview>;
      fetchImpl?: typeof fetch;
      now?: () => Date;
      log?: { warn: (msg: string) => void; info: (msg: string) => void };
    },
  ) {}

  start() {
    if (this.opts.reporting.mode !== 'send') return;
    const tick = (reason: ReportReason) => () => {
      void this.maybeSend(reason)
        .catch((err: Error) => (this.opts.log ?? console).warn(`The record for Backstage couldn’t be made: ${err.message}`))
        .finally(() => {
          this.timer = setTimeout(tick('changed'), LOOK_MS);
          this.timer.unref?.();
        });
    };
    this.timer = setTimeout(tick('started'), FIRST_MS);
    this.timer.unref?.();
  }

  stop() {
    clearTimeout(this.timer);
  }

  /** Sends when it's the first time, something changed, or 15 minutes have passed since the last record went. */
  async maybeSend(reason: ReportReason) {
    const { reporting, store, overview, fetchImpl = fetch, now = () => new Date(), log = console } = this.opts;
    if (reporting.mode !== 'send' || !reporting.url || !reporting.deployment) return undefined;
    const at = now();
    const report = reportOf(await overview(), { deployment: reporting.deployment, reason, now: at });
    const print = fingerprint(report);
    const due = at.getTime() - this.sentAt >= HEARTBEAT_MS;
    if (this.sentPrint === print && !due) return undefined;
    if (this.sentPrint === print) report.reason = 'heartbeat';
    const body = signReport(report, await deploymentKey(store));
    try {
      const res = await fetchImpl(reporting.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
      if (!res.ok) {
        const problem = ((await res.json().catch(() => ({}))) as { problem?: string }).problem ?? `Backstage answered ${res.status}.`;
        this.last = { at: at.toISOString(), reason: report.reason, ok: false, problem };
      } else {
        this.last = { at: at.toISOString(), reason: report.reason, ok: true };
        this.sentPrint = print;
        this.sentAt = at.getTime();
      }
    } catch (err) {
      this.last = { at: at.toISOString(), reason: report.reason, ok: false, problem: `Backstage couldn’t be reached at ${reporting.url}: ${(err as Error).message}` };
    }
    if (this.last.ok) log.info(`Deployment record sent to Backstage (${report.reason}).`);
    else log.warn(`Deployment record not taken: ${this.last.problem}`);
    return this.last;
  }
}

/** What the Upgrade Centre shows about reporting. */
export interface ReportingView {
  mode: Reporting['mode'];
  why: string;
  deployment?: string;
  /** For the augur.dev/report-key annotation in Backstage's catalog. */
  publicKey?: string;
  last?: LastSend;
}

export const reportRoutes =
  ({ reporting, store, sender, overview, now = () => new Date() }: { reporting: Reporting; store: AppStore; sender: ReportSender; overview: () => Promise<Overview>; now?: () => Date }) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    const isAdmin = (req: FastifyRequest) => !!callerFromHeaders(req.headers)?.roles.includes('admin');

    /** Whether this server reports, why, its public key, and how the last send went. */
    app.get(
      '/platform/reporting',
      {
        schema: {
          summary: 'Whether this server reports what it runs to Backstage, its public key and the last send (admins only)',
          description: [
            'ADR 0019. mode is send (DEPLOYMENT_ID and PORTAL_URL set), file (DEPLOYMENT_ID only: export and carry',
            'the record) or off (DEPLOYMENT_REPORTING=off, or no DEPLOYMENT_ID), with why in a sentence. publicKey is',
            "the deployment's Ed25519 key as base64 SPKI, for the augur.dev/report-key annotation in Backstage.",
          ].join(' '),
          response: {
            200: { ...ref(ReportingSchema), description: 'How this server reports' },
            403: refused('Not an admin'),
          },
        },
      },
      async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see how this server reports what it runs.' });
        const key = reporting.mode === 'off' ? undefined : await deploymentKey(store);
        const view: ReportingView = { mode: reporting.mode, why: reporting.why, ...(reporting.deployment ? { deployment: reporting.deployment } : {}), ...(key ? { publicKey: publicKeyLine(key) } : {}), ...(sender.last ? { last: sender.last } : {}) };
        return view;
      },
    );

    /** The signed record as a file, for an admin to carry to Backstage from an air-gapped server. */
    app.get(
      '/platform/reporting/export',
      {
        schema: {
          summary: 'The signed record of what this server runs, as a file to carry to Backstage (admins only)',
          description: [
            'The same body the registry sends Backstage: the record as signed (payload, a JSON string in the format',
            'augur.deployment-report/1) and its Ed25519 signature. It holds no personal data.',
          ].join(' '),
          response: {
            200: { ...ref(SignedReport), description: 'The signed record, as an attachment' },
            403: refused('Not an admin'),
            409: refused('Reporting is off, with why (error reporting_off)'),
          },
        },
      },
      async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can export what this server runs.' });
        if (reporting.mode === 'off' || !reporting.deployment) return reply.code(409).send({ error: 'reporting_off', message: reporting.why });
        const at = now();
        const signed = signReport(reportOf(await overview(), { deployment: reporting.deployment, reason: 'export', now: at }), await deploymentKey(store));
        // Pretty-printed, as a file a person carries: a string goes out as it is.
        return reply
          .header('content-disposition', `attachment; filename="${reporting.deployment}-${at.toISOString().slice(0, 10)}.json"`)
          .type('application/json')
          .send(JSON.stringify(signed, null, 2) as unknown as typeof signed);
      },
    );
  };
