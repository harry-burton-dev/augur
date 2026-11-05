// Grafana's alerts, as notices (ADR 0059): the deployment's Grafana (otel-lgtm) evaluates AUGUR's alert
// rules (infra/deploy/observability) and posts to this webhook when one starts or stops firing. The
// registry tells deployment admins in the shell, once per incident and once when it clears. Grafana sits
// outside the gateway and the notices, so its email (once the relay is set) still goes when this can't.
import { timingSafeEqual } from 'node:crypto';
import type { NewNotification } from '@augur/service-kit';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { refused } from './schemas.ts';
import { DEPLOYMENT_ADMIN } from './roles.ts';

/** The app an alert opens: Admin, whose Status page shows every part. */
export const ALERTS_APP = 'admin';
const WHO = [`role:${DEPLOYMENT_ADMIN}`];

/** One alert in Grafana's webhook body (its Alertmanager-shaped payload). */
export interface GrafanaAlert {
  status: 'firing' | 'resolved' | string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  fingerprint?: string;
}

const WebhookBody = Type.Object(
  {
    alerts: Type.Array(
      Type.Object(
        {
          status: Type.String(),
          labels: Type.Optional(Type.Record(Type.String(), Type.String())),
          annotations: Type.Optional(Type.Record(Type.String(), Type.String())),
          startsAt: Type.Optional(Type.String()),
          endsAt: Type.Optional(Type.String()),
          fingerprint: Type.Optional(Type.String()),
        },
        { additionalProperties: true },
      ),
      { maxItems: 100 },
    ),
  },
  { additionalProperties: true, description: "Grafana's webhook contact point body: the alerts that started or stopped firing" },
);

const minutesBetween = (from?: string, to?: string) => {
  const a = Date.parse(from ?? '');
  const b = Date.parse(to ?? '');
  return Number.isNaN(a) || Number.isNaN(b) ? undefined : Math.max(0, Math.round((b - a) / 60_000));
};

/**
 * The notice an alert makes. One per incident: the key is the alert's fingerprint and when it started, so
 * Grafana repeating itself tells nobody twice, and the recovery has its own key.
 */
export function noticeOf(alert: GrafanaAlert): NewNotification | undefined {
  const id = alert.fingerprint ?? alert.labels?.alertname;
  if (!id) return undefined;
  const incident = `${id}:${alert.startsAt ?? ''}`;
  const title = (alert.annotations?.summary || alert.labels?.alertname || 'An alert').slice(0, 200);
  if (alert.status === 'resolved') {
    const minutes = minutesBetween(alert.startsAt, alert.endsAt);
    return {
      app: ALERTS_APP,
      recipients: [],
      audience: WHO,
      key: `alert-cleared:${incident}`,
      level: 'done',
      title: `Cleared: ${title}`.slice(0, 200),
      ...(minutes !== undefined ? { detail: `It lasted ${minutes} minute${minutes === 1 ? '' : 's'}.` } : {}),
      link: '/status',
    };
  }
  return {
    app: ALERTS_APP,
    recipients: [],
    audience: WHO,
    key: `alert:${incident}`,
    level: 'needs',
    title,
    ...(alert.annotations?.description ? { detail: alert.annotations.description.slice(0, 1000) } : {}),
    link: '/status',
  };
}

const sameToken = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export interface AlertRouteOptions {
  /** ALERT_WEBHOOK_TOKEN: what Grafana sends as its bearer token. Without it the webhook refuses everything. */
  token?: string;
  /** Sends a notice through the events service. Without it the webhook says notices can't be sent. */
  send?: (n: NewNotification) => Promise<void>;
}

export const alertRoutes =
  ({ token, send }: AlertRouteOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    app.post(
      '/platform/alerts',
      {
        bodyLimit: 512 * 1024,
        schema: {
          summary: "Grafana's alerts, told to deployment admins as notices (ALERT_WEBHOOK_TOKEN only)",
          description: [
            "ADR 0059. The deployment's Grafana posts here when one of AUGUR's alert rules starts or stops firing, with",
            'ALERT_WEBHOOK_TOKEN as its bearer token. Each alert becomes one notice to deployment admins, keyed by its',
            'fingerprint and start, so a repeat tells nobody twice; a resolved alert says it cleared and how long it lasted.',
          ].join(' '),
          body: WebhookBody,
          response: {
            202: Type.Object({ told: Type.Integer({ description: 'Notices sent' }) }, { description: 'Taken' }),
            401: refused('No ALERT_WEBHOOK_TOKEN, or not this one'),
            503: refused("Notices can't be sent right now"),
          },
        },
      },
      async (req, reply) => {
        const given = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
        if (!token || !given || !sameToken(given, token)) {
          return reply.code(401).send({ error: 'unauthenticated', message: token ? 'That isn’t this deployment’s alert token.' : 'Alerts aren’t taken here: ALERT_WEBHOOK_TOKEN isn’t set in the deployment’s .env.' });
        }
        if (!send) return reply.code(503).send({ error: 'unavailable', message: 'Notices can’t be sent: the registry has no events service or sign-in of its own.' });
        let told = 0;
        try {
          for (const alert of req.body.alerts) {
            const notice = noticeOf(alert);
            if (!notice) continue;
            await send(notice);
            told++;
          }
        } catch (err) {
          req.log.error({ err: (err as Error).message }, 'alert notice not sent');
          return reply.code(503).send({ error: 'unavailable', message: 'Notices can’t be sent right now; Grafana will try again.' });
        }
        return reply.code(202).send({ told });
      },
    );
  };
