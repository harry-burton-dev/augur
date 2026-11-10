import { describe, expect, it } from 'vitest';
import { haltedInstallWhyNot, reasonProblem, TOO_OLD } from './halted.js';
import { gateFor } from './roles.js';
import type { Upgrade } from './types.js';

const admin = gateFor(true);

describe('installing a halted release for a test', () => {
  it('is allowed only where the registry says so, and says why not', () => {
    expect(haltedInstallWhyNot({ ring: 'preview', haltedInstall: { allowed: true } }, admin)).toBeUndefined();
    expect(haltedInstallWhyNot({ ring: 'production', haltedInstall: { allowed: false, why: 'This is a production server.' } }, admin)).toBe('This is a production server.');
    expect(haltedInstallWhyNot({ ring: 'production', haltedInstall: { allowed: false } }, admin)).toContain('this is a Production server (SERVER_RING in .env)');
  });

  it('treats a registry that doesn’t answer as too old for it', () => {
    expect(haltedInstallWhyNot({ ring: 'dev' }, admin)).toBe(TOO_OLD);
  });

  it('needs the role, and waits for an upgrade under way', () => {
    expect(haltedInstallWhyNot({ ring: 'dev', haltedInstall: { allowed: true } }, gateFor(false))).toContain('deployment-admin');
    const upgrade: Upgrade = { id: 'u1', from: '0.13.1', version: '0.13.2', requestedBy: 'p1', requestedAt: '', state: 'running', steps: [] };
    expect(haltedInstallWhyNot({ ring: 'dev', haltedInstall: { allowed: true }, upgrade }, admin)).toBe('Wait for the upgrade under way to finish.');
    expect(haltedInstallWhyNot({ ring: 'dev', haltedInstall: { allowed: true }, upgrade: { ...upgrade, state: 'rolled-back' } }, admin)).toBeUndefined();
  });

  it('asks for a reason of one line, 10 to 500 characters', () => {
    expect(reasonProblem('')).toContain('Say why');
    expect(reasonProblem('   ')).toContain('Say why');
    expect(reasonProblem('too short')).toContain('at least 10');
    expect(reasonProblem('first line\nsecond line')).toBe('Keep the reason to one line.');
    expect(reasonProblem('x'.repeat(501))).toContain('500 characters or fewer');
    expect(reasonProblem('Proving the go-back on staging')).toBeUndefined();
    expect(reasonProblem('x'.repeat(500))).toBeUndefined();
  });
});
