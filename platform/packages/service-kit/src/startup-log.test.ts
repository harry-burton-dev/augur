import { describe, expect, it } from 'vitest';
import { startupLog } from './startup-log.js';

describe('startup log', () => {
  it('writes JSON lines that name the service, as Fastify’s logger does', () => {
    const lines: string[] = [];
    const log = startupLog('registry', {}, { write: (line) => lines.push(line) });
    log.warn('EVENTS_URL is not set: changes are not audited.');
    log.info('ready', { port: 8082 });
    const [warn, info] = lines.map((l) => JSON.parse(l));
    expect(warn).toMatchObject({ level: 40, name: 'registry', msg: 'EVENTS_URL is not set: changes are not audited.' });
    expect(info).toMatchObject({ level: 30, name: 'registry', msg: 'ready', port: 8082 });
  });

  it('says nothing in tests', () => {
    const lines: string[] = [];
    startupLog('registry', { NODE_ENV: 'test' }, { write: (line) => lines.push(line) }).error('nope');
    expect(lines).toEqual([]);
  });
});
