// Reflect's schedule (plan PR 7): what is summarised, when, and how many a day. The load model is a day of a
// deployment of 2,000 people, played minute by minute through the same picking the service uses.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGETS, MAX_SUMMARY, pick, type ReflectBudgets, reflectMessages, restKey, summaryFrom, type Wanted } from './reflect.ts';

const at = (min: number) => new Date(Date.UTC(2026, 10, 10, 0, min));
const w = (entity: string, floor: string, min: number): Wanted => ({ entity, floor, changedAt: at(min) });

describe('reflect', () => {
  it('picks the oldest change first, within the day’s and each floor’s budget, and leaves out what rests', () => {
    const budgets: ReflectBudgets = { debounceSeconds: 600, daily: 3, perFloor: 2 };
    const wanted = [w('e1', 'team-a', 5), w('e2', 'team-a', 1), w('e3', 'team-a', 2), w('e4', 'team-b', 3), w('e5', 'team-c', 4)];
    expect(pick(wanted, new Map(), budgets).map((x) => x.entity)).toEqual(['e2', 'e3', 'e4']);
    // Team A has used its two today; the deployment has one left.
    expect(pick(wanted, new Map([['team-a', 2]]), budgets).map((x) => x.entity)).toEqual(['e4']);
    expect(pick(wanted, new Map([['team-a', 2], ['team-b', 1]]), budgets)).toEqual([]);
    // A floor the models service refused, and one entity whose reply was unusable, rest until tomorrow.
    expect(pick(wanted, new Map(), budgets, new Set(['team-a', restKey({ entity: 'e4', floor: 'team-b' })])).map((x) => x.entity)).toEqual(['e5']);
  });

  it('fences the beliefs it asks about, and keeps a reply short and plain', () => {
    const [system, user] = reflectMessages(
      [{ label: 'MV Saltmarsh Heron', predicate: 'kg:capacity', value: { v: 212, unit: 'TEU' }, object_label: null, valid_from: null, valid_to: null, modality: 'reported' },
       { label: 'MV Saltmarsh Heron', predicate: 'kg:boundFor', value: null, object_label: 'Port of Brackwater', valid_from: new Date('2026-11-04T00:00:00Z'), valid_to: null, modality: 'expected' }],
      'F1',
    );
    expect(system!.content).toContain('<<beliefs F1>>');
    expect(system!.content).not.toContain('Saltmarsh');
    expect(user!.content).toBe('What the floor believes about MV Saltmarsh Heron:\n<<beliefs F1>>\n- kg:capacity: 212 TEU\n- kg:boundFor: Port of Brackwater (2026-11-04 to ) [expected]\n<<end F1>>');
    expect(summaryFrom('  \n ')).toBeUndefined();
    expect(summaryFrom(' She carries\n212 TEU. ')).toBe('She carries 212 TEU.');
    const long = summaryFrom(`${'She sails. '.repeat(200)}`)!;
    expect(long.length).toBeLessThanOrEqual(MAX_SUMMARY);
    expect(long.endsWith('.')).toBe(true);
  });

  it('keeps its defaults under the models service’s own default limit, with room for extraction', () => {
    expect(DEFAULT_BUDGETS.daily).toBeLessThan(500);
    expect(DEFAULT_BUDGETS.perFloor).toBeLessThanOrEqual(DEFAULT_BUDGETS.daily);
  });

  // The load model. A day at a deployment of 2,000 people: 100 teams of 20 under 10 departments and the org.
  // Each person retains 6 texts between 08:00 and 17:00 UTC (12,000 extraction calls), each naming 4 entities:
  // 2 from their team's 200 in common use, 2 of their own 60. What a person retains is memory on their own floor
  // at once; a third of the team entities it names are held on the team floor 1 to 3 hours later, and one in
  // ten of those raised to the department an hour after that. A summary is stale when its entity's beliefs
  // change anywhere (kg.stale_summaries), so a change on one floor asks again on each floor that holds the
  // entity. The budgets are what a deployment of this size would set: the models service at its highest
  // daily limit, 100,000 calls, with 85,000 of them for reflect. What the budget leaves waits for the next day,
  // marked older than its beliefs.
  it('summarises a day at 2,000 people within the models service’s cap, and never past its budgets', () => {
    let seed = 42;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const int = (n: number) => Math.floor(random() * n);
    const PEOPLE = 2000, TEAM = 20, TEAM_ENTITIES = 200, OWN_ENTITIES = 60, TEXTS = 6, MINUTES = 24 * 60;
    const budgets: ReflectBudgets = { debounceSeconds: 600, daily: 85_000, perFloor: 500 };
    const extraction = PEOPLE * TEXTS;

    // When each entity's beliefs change, and which floors hold it.
    const changes: { min: number; entity: string; floor: string }[] = [];
    for (let p = 0; p < PEOPLE; p++) {
      const team = Math.floor(p / TEAM);
      for (let t = 0; t < TEXTS; t++) {
        const min = 8 * 60 + int(9 * 60);
        for (let k = 0; k < 4; k++) {
          const shared = k < 2;
          const entity = shared ? `t${team}-${int(TEAM_ENTITIES)}` : `p${p}-${int(OWN_ENTITIES)}`;
          changes.push({ min, entity, floor: `own-${p}` });
          if (shared && random() < 1 / 3) {
            const held = min + 60 + int(120);
            changes.push({ min: held, entity, floor: `team-${team}` });
            if (random() < 0.1) changes.push({ min: held + 60, entity, floor: `dept-${team % 10}` });
          }
        }
      }
    }
    changes.sort((a, b) => a.min - b.min);

    const holders = new Map<string, Set<string>>();
    const lastChange = new Map<string, number>();
    const summarisedAsOf = new Map<string, number>();
    const used = new Map<string, number>();
    const pending = new Set<string>();
    let calls = 0;
    let next = 0;
    for (let min = 0; min < MINUTES; min++) {
      for (; next < changes.length && changes[next]!.min <= min; next++) {
        const c = changes[next]!;
        (holders.get(c.entity) ?? holders.set(c.entity, new Set()).get(c.entity)!).add(c.floor);
        lastChange.set(c.entity, min);
        pending.add(c.entity);
      }
      const wanted: Wanted[] = [];
      for (const entity of pending) {
        const changed = lastChange.get(entity)!;
        if (changed > min - budgets.debounceSeconds / 60) continue;
        for (const floor of holders.get(entity)!) {
          const key = `${entity} ${floor}`;
          if ((summarisedAsOf.get(key) ?? -1) < changed) wanted.push({ entity, floor, changedAt: at(changed) });
        }
      }
      for (const chosen of pick(wanted, used, budgets)) {
        summarisedAsOf.set(`${chosen.entity} ${chosen.floor}`, (chosen.changedAt.getTime() - at(0).getTime()) / 60_000);
        used.set(chosen.floor, (used.get(chosen.floor) ?? 0) + 1);
        calls += 1;
      }
      for (const entity of pending) {
        if ([...holders.get(entity)!].every((f) => (summarisedAsOf.get(`${entity} ${f}`) ?? -1) >= lastChange.get(entity)!)) pending.delete(entity);
      }
    }

    // What waits at the day's end: summaries the budget left, each marked older than its beliefs.
    const behind = [...lastChange].flatMap(([entity, changed]) => [...holders.get(entity)!].filter((f) => (summarisedAsOf.get(`${entity} ${f}`) ?? -1) < changed));
    // The figures, for the record (the pull request quotes them).
    console.info(`reflect load model: ${calls} summaries and ${extraction} extractions, ${calls + extraction} model calls a day at ${PEOPLE} people; ${behind.length} summaries wait`);
    expect(calls).toBeLessThanOrEqual(budgets.daily);
    expect(Math.max(...used.values())).toBeLessThanOrEqual(budgets.perFloor);
    expect(calls + extraction).toBeLessThan(100_000);
    // The budget is sized to the day: what it leaves is a few per cent, not a backlog that grows.
    expect(behind.length).toBeLessThan(calls * 0.05);
  });
});
