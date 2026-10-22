import { describe, expect, it } from 'vitest';
import { floorBeside, floorDirection, floorStack, type ShellFloor } from './floors.js';

const org: ShellFloor = { id: 'org', kind: 'org', name: 'Acme', path: [{ id: 'org', kind: 'org', name: 'Acme' }] };
const finance: ShellFloor = { id: 'fin', kind: 'team', name: 'Finance', path: [org.path[0], { id: 'fin', kind: 'team', name: 'Finance' }] };
const payroll: ShellFloor = { id: 'pay', kind: 'team', name: 'Payroll', path: [...finance.path, { id: 'pay', kind: 'team', name: 'Payroll' }] };
const legal: ShellFloor = { id: 'leg', kind: 'team', name: 'Legal', path: [org.path[0], { id: 'leg', kind: 'team', name: 'Legal' }] };
const me: ShellFloor = { id: 'me', kind: 'personal', name: 'You', path: [{ id: 'me', kind: 'personal', name: 'You' }] };
const floors = [me, org, finance, payroll, legal];

describe('floors', () => {
  it('stacks you, your team and those above it, then the org', () => {
    expect(floorStack(floors, 'pay').map((f) => f.name)).toEqual(['You', 'Payroll', 'Finance', 'Acme']);
    expect(floorStack(floors, 'leg').map((f) => f.name)).toEqual(['You', 'Legal', 'Acme']);
    // Off a team, the last one you were on, or else the deepest.
    expect(floorStack(floors, 'me', 'leg').map((f) => f.name)).toEqual(['You', 'Legal', 'Acme']);
    expect(floorStack(floors, 'org').map((f) => f.name)).toEqual(['You', 'Payroll', 'Finance', 'Acme']);
    expect(floorStack([me, org], 'me').map((f) => f.name)).toEqual(['You', 'Acme']);
  });

  it('finds the floor above and below', () => {
    expect(floorBeside(floors, 'me', 'up', 'leg')?.name).toBe('Legal');
    expect(floorBeside(floors, 'pay', 'up')?.name).toBe('Finance');
    expect(floorBeside(floors, 'fin', 'down', 'pay')?.name).toBe('Payroll');
    expect(floorBeside(floors, 'org', 'up')).toBeUndefined();
    expect(floorBeside(floors, 'me', 'down')).toBeUndefined();
  });

  it('says which way a move goes', () => {
    expect(floorDirection(me, finance)).toBe('up');
    expect(floorDirection(finance, payroll)).toBe('down');
    expect(floorDirection(payroll, org)).toBe('up');
    expect(floorDirection(finance, legal)).toBe('across');
    expect(floorDirection(undefined, org)).toBe('across');
  });
});
