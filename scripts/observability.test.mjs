// The alert rules and dashboard provisioned into the deployment's Grafana (ADR 0059) stay
// readable and point only at what exists: the stack's own data sources, and the metrics the gateway
// records. Grafana itself isn't run in CI; this is the check that holds the files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const dir = new URL('../infra/deploy/observability/grafana/', import.meta.url);
/** otel-lgtm's own data sources, and Grafana's expressions. */
const SOURCES = new Set(['prometheus', 'loki', 'tempo', '__expr__']);
/** What the gateway records (platform/services/gateway/src/metrics.ts), as Prometheus names them. */
const METRICS = ['augur_component_up', 'augur_gateway_requests_total', 'augur_backup_ok'];
const metricsIn = (expr) => (expr.match(/\baugur_[a-z_]+/g) ?? []);

test('every alert rule is whole and reads only what exists', () => {
  const { apiVersion, groups } = parse(readFileSync(new URL('alerting/rules.yaml', dir), 'utf8'));
  assert.equal(apiVersion, 1);
  const uids = new Set();
  for (const group of groups) {
    assert.ok(group.folder && group.name && group.interval, 'a group has a folder, a name and an interval');
    for (const rule of group.rules) {
      assert.ok(!uids.has(rule.uid), `${rule.uid} is used once`);
      uids.add(rule.uid);
      assert.ok(rule.title && rule.annotations?.summary && rule.annotations?.description, `${rule.uid} says what is wrong in words`);
      assert.ok(['OK', 'Alerting', 'NoData'].includes(rule.noDataState), `${rule.uid} says what no data means`);
      const refs = rule.data.map((d) => d.refId);
      assert.ok(refs.includes(rule.condition), `${rule.uid}'s condition is one of its queries`);
      for (const d of rule.data) {
        assert.ok(SOURCES.has(d.datasourceUid), `${rule.uid} reads ${d.datasourceUid}, which otel-lgtm has`);
        if (d.datasourceUid === '__expr__') continue;
        for (const m of metricsIn(d.model.expr)) assert.ok(METRICS.includes(m), `${rule.uid} reads ${m}, which the gateway records`);
      }
    }
  }
  assert.ok(uids.has('augur-part-down') && uids.has('augur-server-errors'), 'the two failures goal 23 names have rules');
});

test('the dashboard reads only what exists', () => {
  const dash = JSON.parse(readFileSync(new URL('dashboards/augur.json', dir), 'utf8'));
  assert.equal(dash.uid, 'augur');
  for (const panel of dash.panels) {
    assert.ok(panel.title && panel.description, `panel ${panel.id} says what it shows`);
    for (const t of panel.targets) {
      assert.ok(SOURCES.has(t.datasource.uid), `panel ${panel.id} reads ${t.datasource.uid}`);
      for (const m of metricsIn(t.expr)) assert.ok(METRICS.includes(m), `panel ${panel.id} reads ${m}, which the gateway records`);
    }
  }
});

test('alerts go to the registry’s webhook, with its token, and are told again only daily', () => {
  const { contactPoints, policies } = parse(readFileSync(new URL('alerting/contact-points.yaml', dir), 'utf8'));
  const names = new Set(contactPoints.map((c) => c.name));
  const hook = contactPoints.flatMap((c) => c.receivers).find((r) => r.type === 'webhook');
  assert.match(hook.settings.url, /^http:\/\/registry:\d+\/v1\/platform\/alerts$/);
  assert.equal(hook.settings.authorization_credentials, '$ALERT_WEBHOOK_TOKEN', 'the token comes from compose, never the file');
  assert.equal(hook.disableResolveMessage, false, 'a cleared alert is told too');
  for (const p of policies) assert.ok(names.has(p.receiver), `the policy sends to ${p.receiver}, which is defined`);
});
