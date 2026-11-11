import { metrics } from '@opentelemetry/api';
import type { Caller } from './caller.js';
import { callService, type ServiceCredentials } from './service.js';

/**
 * Shadow mode (ADR 0085, step 1 of moving over): beside each check a service already makes, the same question
 * goes to the permissions service, and the two answers are compared. Today's answer still decides; the
 * permissions service's answer is only counted and, when they differ, logged with both. A site moves over to
 * the permissions service once it has gone quiet (no disagreement for 7 days on the workbench).
 *
 * The question is asked after the reply is on its way and never slows it down or changes it. When the
 * permissions service can't answer, that is counted as unanswered, not as a disagreement.
 */

/** What the permissions service is asked: one of the model's relations on one resource. */
export interface ShadowQuestion {
  /** The model's relation, such as `can_manage_people`. */
  action: string;
  /** The model's type and id. `org:this` and `deployment:this` mean this deployment's org and the deployment. */
  resource: { type: string; id: string };
  /**
   * Who asks. `person` (the default): the caller as themselves, with the positions they hold. `persona`: any
   * persona the caller holds, which is how admin powers work once they act as one (ADR 0086). Until then,
   * today's admin roles are copied in as one admin persona each.
   */
  as?: 'person' | 'persona';
}

/** The permissions service couldn't answer a check it decides: the caller is refused, and told why. */
export class PermissionsUnavailable extends Error {
  constructor() {
    super('Who may do this can’t be checked right now, so nothing was changed. Try again in a minute; a deployment admin can see why on Status.');
  }
}

export interface Shadow {
  /**
   * Compares `today` (the answer the service just gave) with the permissions service's answer to the same
   * question. `site` names the check, the same at every call, such as `events.audit.read`. Several questions
   * mean today's check allows any of them, as "a lead of the team, or an admin" does.
   */
  check(site: string, caller: Pick<Caller, 'id'>, question: ShadowQuestion | readonly ShadowQuestion[], today: boolean): void;
  /**
   * Step 2 of moving over: the answer at `site`. Where the deployment has moved the site over
   * (`PERMISSIONS_DECIDES`), the permissions service's answer, or `PermissionsUnavailable` when it can't give
   * one: a check that decides never falls back to the old one. Anywhere else, `today`, compared as `check` does.
   */
  decide(site: string, caller: Pick<Caller, 'id'>, question: ShadowQuestion | readonly ShadowQuestion[], today: boolean): Promise<boolean>;
  /** Resolves once every comparison started so far is done: for tests and a clean stop. */
  settled(): Promise<void>;
}

/** No shadow: where no permissions service is named. Today's checks decide. */
export const noShadow: Shadow = { check: () => {}, decide: async (_site, _caller, _question, today) => today, settled: async () => {} };

/** A service's own log (startupLog). */
export interface ShadowLog {
  warn(message: string, fields?: Record<string, unknown>): void;
}

/** Where the counts go: OpenTelemetry's meter unless a test gives its own. */
export interface ShadowMeter {
  createCounter(name: string, options?: { description?: string }): { add(value: number, attributes?: Record<string, string>): void };
}

export interface ShadowOptions {
  /** Where the permissions service is, such as http://permissions:8087. */
  permissionsUrl: string;
  /** The service's own sign-in: only the gateway and AUGUR's services may ask. */
  credentials: ServiceCredentials;
  log: ShadowLog;
  meter?: ShadowMeter;
  /** The sites the permissions service decides, or `all`; every other site is only compared. */
  decides?: ReadonlySet<string> | 'all';
  /** The most comparisons in flight; more are skipped and counted, so shadow mode can't load a busy service. */
  maxInFlight?: number;
  fetchImpl?: typeof fetch;
}

type Outcome = 'agree' | 'disagree' | 'unanswered' | 'skipped';

/** The most evaluations one call to the permissions service may carry. */
const BATCH = 50;

export const permissionsShadow = ({ permissionsUrl, credentials, log, meter = metrics.getMeter('permissions-shadow'), decides = new Set(), maxInFlight = 20, fetchImpl }: ShadowOptions): Shadow => {
  const base = `${permissionsUrl.replace(/\/$/, '')}/access/v1`;
  const checks = meter.createCounter('augur.permissions.shadow.checks', {
    description: 'Checks compared with the permissions service, by site and outcome (agree, disagree, unanswered, skipped)',
  });
  const disagreements = meter.createCounter('augur.permissions.shadow.disagreements', {
    description: 'Checks where the permissions service answered differently from the service’s own check, by site',
  });
  const inFlight = new Set<Promise<void>>();

  const ask = async (path: string, body: unknown, what: string) => callService({ method: 'POST', url: `${base}/${path}`, credentials, body, what, fetchImpl });

  const answer = async (caller: Pick<Caller, 'id'>, q: ShadowQuestion): Promise<boolean> => {
    const action = { name: q.action };
    if ((q.as ?? 'person') === 'person') {
      const reply = (await ask('evaluation', { subject: { type: 'person', id: caller.id }, action, resource: q.resource }, 'ask the permissions service')) as { decision?: unknown };
      if (typeof reply.decision !== 'boolean') throw new Error('The permissions service gave no decision.');
      return reply.decision;
    }
    const held = (await ask('search/resource', { subject: { type: 'person', id: caller.id }, action: { name: 'holder' }, resource: { type: 'persona' } }, 'ask which personas someone holds')) as {
      results?: { id: string }[];
    };
    const personas = (held.results ?? []).map((r) => r.id);
    for (let i = 0; i < personas.length; i += BATCH) {
      const batch = personas.slice(i, i + BATCH);
      const reply = (await ask(
        'evaluations',
        { action, resource: q.resource, evaluations: batch.map((id) => ({ subject: { type: 'persona', id } })), options: { evaluations_semantic: 'permit_on_first_permit' } },
        'ask the permissions service',
      )) as { evaluations?: { decision?: unknown }[] };
      if (reply.evaluations?.some((d) => d.decision === true)) return true;
    }
    return false;
  };

  const count = (site: string, outcome: Outcome) => checks.add(1, { site, outcome });
  const decided = meter.createCounter('augur.permissions.decided', {
    description: 'Checks the permissions service decided, by site and outcome (allowed, refused, unanswered)',
  });
  const listOf = (question: ShadowQuestion | readonly ShadowQuestion[]): readonly ShadowQuestion[] => (Array.isArray(question) ? question : [question as ShadowQuestion]);
  const anyOf = async (caller: Pick<Caller, 'id'>, questions: readonly ShadowQuestion[]) => {
    for (const q of questions) if (await answer(caller, q)) return true;
    return false;
  };

  const shadow: Shadow = {
    async decide(site, caller, question, today) {
      if (decides !== 'all' && !decides.has(site)) {
        shadow.check(site, caller, question, today);
        return today;
      }
      try {
        const allowed = await anyOf(caller, listOf(question));
        decided.add(1, { site, outcome: allowed ? 'allowed' : 'refused' });
        return allowed;
      } catch {
        decided.add(1, { site, outcome: 'unanswered' });
        throw new PermissionsUnavailable();
      }
    },
    check(site, caller, question, today) {
      if (inFlight.size >= maxInFlight) return count(site, 'skipped');
      const questions = listOf(question);
      const compared: Promise<void> = anyOf(caller, questions)
        .then((theirs) => {
          if (theirs === today) return count(site, 'agree');
          count(site, 'disagree');
          disagreements.add(1, { site });
          log.warn(
            `permissions shadow: ${site} answered ${today ? 'yes' : 'no'}, the permissions service ${theirs ? 'yes' : 'no'}`,
            { site, caller: caller.id, asked: questions.map((q) => `${q.as ?? 'person'} ${q.action} ${q.resource.type}:${q.resource.id}`), today, permissions: theirs },
          );
        })
        .catch(() => count(site, 'unanswered'))
        .finally(() => inFlight.delete(compared));
      inFlight.add(compared);
    },
    async settled() {
      while (inFlight.size) await Promise.all(inFlight);
    },
  };
  return shadow;
};

/** The sites `PERMISSIONS_DECIDES` names: a comma-separated list such as `models.settings,models.usage`, or `all`. */
export const decidesFrom = (value: string | undefined): ReadonlySet<string> | 'all' => {
  const sites = (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return sites.includes('all') ? 'all' : new Set(sites);
};

/**
 * The shadow a service runs: against PERMISSIONS_URL when it is set and the service can sign in, otherwise none.
 * It decides the sites PERMISSIONS_DECIDES names; without a permissions service, today's checks still decide.
 */
export const shadowFromEnv = (credentials: ServiceCredentials | undefined, log: ShadowLog, env: Record<string, string | undefined> = process.env): Shadow =>
  env.PERMISSIONS_URL && credentials ? permissionsShadow({ permissionsUrl: env.PERMISSIONS_URL, credentials, log, decides: decidesFrom(env.PERMISSIONS_DECIDES) }) : noShadow;
