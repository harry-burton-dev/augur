import type { UiToggle } from '@augur/ui-kit';
import '@augur/ui-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminApi, type ModelSettings } from './api.js';
import { todayRows, type AdminAgents } from './agents.js';
import { screenFor } from './entry.js';

const today = new Date().toISOString().slice(0, 10);

/** A model gateway that answers like the real one, recording what was sent. */
const gateway = (settings: ModelSettings) => {
  const sent: { method: string; url: string; body?: unknown }[] = [];
  let current = settings;
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    sent.push({ method, url: String(url), body });
    if (url === '/api/models/v1/settings' && method === 'PUT') current = { ...current, ...body, updatedAt: new Date().toISOString() };
    if (url === '/api/models/v1/settings') return Response.json(current);
    if (url === '/api/models/v1/usage')
      return Response.json({ dailyLimit: current.dailyLimit, days: [{ day: today, app: 'assistant', calls: 12, inputTokens: 900, outputTokens: 100 }, { day: today, app: 'library', calls: 40, inputTokens: 1, outputTokens: 1 }] });
    return Response.json({ message: 'not here' }, { status: 404 });
  });
  return { sent, api: new AdminApi(async () => 'token', fetchImpl as unknown as typeof fetch) };
};

const settle = async (el: Element) => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await Promise.all([el, ...el.querySelectorAll('*')].map((e) => (e as Partial<AdminAgents>).updateComplete));
  }
};

const show = async (settings: ModelSettings) => {
  const g = gateway(settings);
  const el = document.createElement('admin-agents') as AdminAgents;
  el.api = g.api;
  document.body.append(el);
  await settle(el);
  return { el, ...g };
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Agents and AI in Admin', () => {
  it('lives at /agents', () => {
    expect(screenFor('/agents')).toEqual({ screen: 'agents', adding: false });
  });

  it('says agents are off, and turns them on with the switch', async () => {
    const { el, sent } = await show({ enabled: false, dailyLimit: 500, ready: true, provider: 'openrouter.ai', model: 'openai/gpt-4o-mini' });
    expect(el.querySelector('ui-heading')!.getAttribute('heading')).toBe('Agents are off');
    expect(el.querySelector('ui-facts')).toBeTruthy();
    const toggle = el.querySelector<UiToggle>('ui-toggle')!;
    await toggle.change!(true);
    await settle(el);
    expect(sent.at(-1)).toMatchObject({ method: 'PUT', url: '/api/models/v1/settings', body: { enabled: true } });
    expect(el.querySelector('ui-heading')!.getAttribute('heading')).toBe('Agents are on');
  });

  it('can’t be turned on without a model, and says what to set', async () => {
    const { el } = await show({ enabled: false, dailyLimit: 500, ready: false });
    expect(el.querySelector('ui-heading')!.getAttribute('summary')).toContain('MODEL_API_URL');
    expect(el.querySelector<UiToggle>('ui-toggle')!.disabled).toBe(true);
  });

  it('sets the calls a day, and refuses what isn’t a whole number', async () => {
    const { el, sent } = await show({ enabled: true, dailyLimit: 500, ready: true, provider: 'stand-in', model: 'stand-in' });
    const field = el.querySelector('ui-text-field')!;
    field.dispatchEvent(new CustomEvent('ui-change', { detail: { value: '2.5' } }));
    await settle(el);
    expect(field.getAttribute('state')).toBe('error');
    field.dispatchEvent(new CustomEvent('ui-change', { detail: { value: '50' } }));
    await settle(el);
    expect(sent.at(-1)).toMatchObject({ method: 'PUT', body: { dailyLimit: 50 } });
    expect(field.getAttribute('state')).toBe('idle');
  });

  it('shows each app’s use today, busiest first', () => {
    const rows = todayRows(
      [
        { day: today, app: 'assistant', calls: 12, inputTokens: 900, outputTokens: 100 },
        { day: today, app: 'library', calls: 40, inputTokens: 1, outputTokens: 1 },
        { day: '2020-01-01', app: 'old', calls: 1, inputTokens: 0, outputTokens: 0 },
      ],
      today,
      50,
    );
    expect(rows.map((r) => [r.app, r.calls, r.left, r.tokens])).toEqual([
      ['library', 40, 10, 2],
      ['Assistant (the Shell’s own)', 12, 38, 1000],
    ]);
  });
});
