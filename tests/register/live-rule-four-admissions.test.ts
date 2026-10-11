// The committed declaration sources, read as they are: rule 4's Check is an enumeration, so the
// enumeration itself is the thing to pin. Reading the sources rather than generated/register.json
// is deliberate — the generated copy is pinned to the commit the desk last published, so a new
// declaration would be invisible here until regeneration.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ruledThreeBases } from '../../src/register/rungs.js';

type Rung = { decidesAlone?: string; decidesAloneBasis?: string };
type Declaration = { id: string; kind: string; status: string; requiredFacts: Rung & { rungs?: Rung[] };
  standards?: number[]; holds?: { rule: number; class: string }[] };

function sidecars(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sidecars(path, found);
    else if (entry.name.endsWith('.declarations.json')) found.push(path);
  }
  return found;
}
const declarations: Declaration[] = ['src', 'scripts', 'tests'].flatMap(dir => sidecars(dir))
  .flatMap(path => JSON.parse(readFileSync(path, 'utf8')) as Declaration[]);
const live = declarations.filter(d => d.status === 'live');
const rungsOf = (d: Declaration): Rung[] => d.requiredFacts.rungs ?? [d.requiredFacts];
const ruledThree = live.filter(d => d.kind === 'blocking sites' && rungsOf(d).some(r => r.decidesAlone === 'ruled-three'));

describe('the live enumeration rule 4 asks for', () => {
  it('every live ruled-three site names one of rule 4 own admissions', () => {
    expect(ruledThree.length).toBeGreaterThan(0);
    for (const d of ruledThree) for (const rung of rungsOf(d).filter(r => r.decidesAlone === 'ruled-three'))
      expect([d.id, rung.decidesAloneBasis]).toEqual([d.id, expect.stringMatching(new RegExp(`^(?:${ruledThreeBases.join('|')})$`))]);
    // The negative side: no site that asks the mind or enforces a record carries a basis.
    for (const d of live.filter(d => d.kind === 'blocking sites'))
      for (const rung of rungsOf(d).filter(r => r.decidesAlone !== 'ruled-three'))
        expect([d.id, rung.decidesAloneBasis]).toEqual([d.id, undefined]);
  });
  it('each of rule 4 three irreversible-miss cases has at least one live registered site', () => {
    const bases = new Set(ruledThree.flatMap(d => rungsOf(d).map(r => r.decidesAloneBasis)));
    for (const miss of ['live-secret-leaving', 'spend-past-a-cap', 'operator-emergency-stop']) expect([...bases]).toContain(miss);
  });
  it('the live ruled-three roster is exactly this set, so a new site cannot join it unnoticed', () => {
    expect(ruledThree.map(d => d.id).sort()).toEqual(['intake.stop', 'preview.journal.capacityRefused', 'preview.journal.gate',
      'preview.journal.pollLimit',
      // Rule 4's recorded-governed-state admission: media fetch dispatches only on an exact match of a
      // recorded policy admission and a consumed reservation; anything else fails closed and keeps the intake.
      'preview.media-admission.createMediaAdmission', 'recall.redact',
      'resource-owner.admit', 'rungraph.exhaustion', 'rungraph.stop', 'rungraph.unreachable']);
  });
  it('rules 60 and 61 each have a live holder, and its honesty class says what is still owed', () => {
    for (const rule of [60, 61]) {
      const holders = live.filter(d => (d.holds ?? []).some(h => h.rule === rule));
      expect(holders.map(d => d.id)).toEqual(['resource-owner.admit']);
      // Deferred, not partial: the ceiling is enforced in code, but the can-fail fixture that
      // proves it belongs to part ten's host tests and is not registered in the catalog yet.
      // A deferral carries a part, a dated ceiling, an owner and an overdue action.
      const hold = (holders[0]!.holds ?? []).find(h => h.rule === rule) as
        { class: string; part?: number; ceiling?: number; owner?: string; overdueAction?: string };
      expect(hold.class).toBe('deferred');
      expect(hold.part).toBe(10);
      expect(hold.ceiling).toBeGreaterThan(1791000000000);
      expect(hold.owner).toBeTruthy(); expect(hold.overdueAction).toBeTruthy();
    }
  });
});
