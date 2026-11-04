/**
 * What the deployment's alert rules read (ADR 0059): whether each part the gateway checks is answering,
 * the calls it passes on by part and outcome, and whether backups can be relied on. Recorded through
 * the OpenTelemetry API, which the service kit's telemetry wires to the collector when one is named
 * (ADR 0034); without one, these cost nothing.
 *
 * In Prometheus they read as augur_component_up, augur_gateway_requests_total and augur_backup_ok.
 */
import { metrics, type Counter, type Meter } from '@opentelemetry/api';
import type { BackupStatus, ComponentStatus } from './status.ts';
import type { TrafficPart } from './traffic.ts';

export interface WatchedParts {
  /** Every part as the gateway last saw it. */
  components: () => ComponentStatus[];
  /** Whether backups can be relied on, when the gateway is told where they are. */
  backups?: () => Promise<BackupStatus>;
}

/** "2xx", "4xx", "5xx": few enough values for a metric. */
export const statusClass = (code: number) => `${Math.floor(code / 100)}xx`;

export class GatewayMetrics {
  private readonly requests: Counter;

  constructor(private readonly meter: Meter = metrics.getMeter('gateway')) {
    this.requests = meter.createCounter('augur.gateway.requests', {
      description: 'Calls the gateway answered, by whose they were (platform or apps) and status class',
    });
  }

  /** Counts one answered call. */
  request(statusCode: number, part: TrafficPart) {
    this.requests.add(1, { part, status_class: statusClass(statusCode) });
  }

  /**
   * Reports each part as 1 (answering) or 0 (down) whenever the collector reads, and backups as 1 or 0.
   * A part not checked yet reports nothing, so a start never looks like an outage.
   */
  watch({ components, backups }: WatchedParts) {
    const up = this.meter.createObservableGauge('augur.component.up', {
      description: 'Whether a part of AUGUR answered its last health check: 1 yes, 0 no',
    });
    up.addCallback((result) => {
      for (const c of components()) {
        if (c.state === 'checking') continue;
        result.observe(c.state === 'down' ? 0 : 1, { component: c.name, kind: c.kind });
      }
    });
    if (backups) {
      const ok = this.meter.createObservableGauge('augur.backup.ok', {
        description: 'Whether the last backup and restore test can be relied on: 1 yes, 0 no',
      });
      ok.addCallback(async (result) => {
        const status = await backups().catch(() => undefined);
        if (status) result.observe(status.state === 'ok' ? 1 : 0);
      });
    }
  }
}
