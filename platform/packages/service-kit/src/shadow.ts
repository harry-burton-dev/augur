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

export interface Shadow {
  /**
   * Compares `today` (the answer the service just gave) with the permissions service's answer to the same
   * question. `site` names the check, the same at every call, such as `events.audit.read`. Several questions
   * mean today's check allows any of them, as "a lead of the team, or an admin" does.
   */
  check(site: string, caller: Pick<Caller, 'id'>, question: ShadowQuestion | readonly ShadowQuestion[], today: boolean): void;
  /** Resolves once every comparison started so far is done: for tests and a clean stop. */
  settled(): Promise<void>;
}

/** No shadow: where no permissions service is named. */
export const noShadow: Shadow = { check: () => {}, settled: async () => {} };

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
  /** The most comparisons in flight; more are skipped and counted, so shadow mode can't load a busy service. */
  maxInFlight?: number;
  fetchImpl?: typeof fetch;
}

type Outcome = 'agree' | 'disagree' | 'unanswered' | 'skipped';

/** The most evaluations one call to the permissions service may carry. */
const BATCH = 50;

export const permissionsShadow = ({ permissionsUrl, credentials, log, meter = metrics.getMeter('permissions-shadow'), maxInFlight = 20, fetchImpl }: ShadowOptions): Shadow => {
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

  return {
    check(site, caller, question, today) {
      if (inFlight.size >= maxInFlight) return count(site, 'skipped');
      const questions: readonly ShadowQuestion[] = Array.isArray(question) ? question : [question as ShadowQuestion];
      const anyOf = async () => {
        for (const q of questions) if (await answer(caller, q)) return true;
        return false;
      };
      const compared: Promise<void> = anyOf()
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
};

/** The shadow a service runs: against PERMISSIONS_URL when it is set and the service can sign in, otherwise none. */
export const shadowFromEnv = (credentials: ServiceCredentials | undefined, log: ShadowLog, env: Record<string, string | undefined> = process.env): Shadow =>
  env.PERMISSIONS_URL && credentials ? permissionsShadow({ permissionsUrl: env.PERMISSIONS_URL, credentials, log }) : noShadow;
