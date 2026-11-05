/**
 * Integration — the correction loop through the existing retrospective owner (carryover row 32; the route the 1.x
 * CorrectionLoopDriver took through its injected capabilities, here through the journal worker's own `retrospect`
 * step and the retrospective's packet, validator and reservation row).
 *
 * Pins: a gate-crossing cluster rides the review packet as `correctionCandidates`; the reservation row records
 * what was presented, durably and replayably; a recurrence finding that cites the candidate is accepted and opens
 * owned root-cause work; a finding that cites a candidate the packet never carried is refused; after the pass the
 * cluster is acted-on and is not presented again. The review answer is a scripted stub (no recorded model output
 * carries the new packet field yet), stated as such.
 */
import { describe, it, expect } from 'vitest';
import { createJournalWorker, type Turn } from './journal.js';
import { GRAVITY_WELLS, RETROSPECTIVE_DUTIES, RETROSPECTIVE_QUESTION, openFindings, type RetroCase } from './retrospective.js';
import { correctionCandidates, correctionLifecycle, presentedCorrections } from './correction-loop-driver.js';
import { correctionWorld, T, type CorrectionWorld } from './correction-fixture.js';

const DAY = 86400_000;
const DIGEST = 'sha256:config-a';
type Packet = { correctionCandidates?: { id: string; kind: string; keys: string[]; occurrences: string[]; learning: string; context: { fromUser: boolean; text: string }[] }[]; cases: RetroCase[] };

function seed(w: CorrectionWorld) {
  const learning = 'lead with the one action';
  for (let i = 0; i < 4; i++) {
    if (i === 2) w.summarize(T('2026-05-01T10:00:00Z') + DAY - 3600_000);
    w.preference(learning, T('2026-05-01T10:00:00Z') + (i % 2) * DAY + i * 60_000);
  }
}
/** A complete answer that defers every case and opens the findings given. */
const answerWith = (packet: Packet, findings: unknown[]) => JSON.stringify({ inspected: [], omitted: packet.cases.map(item => ({ case: item.id, reason: 'answer budget' })),
  duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length), wells: GRAVITY_WELLS.map(() => 0), eff: 'No wasted attempts found in this window.',
  findings, grades: [], feedback: [], authorizations: [], comparisons: [], closures: [] });
const recurrence = (candidate: NonNullable<Packet['correctionCandidates']>[number]) => ({ duty: 'recurrence', refs: candidate.occurrences,
  summary: 'The operator restated the same style preference four times across two days.', recurs: [candidate.id],
  rootCause: 'the standing style is carried but the reply still opens with preamble', structuralRemedy: { none: 'watch the next window first' },
  disposition: { owner: 'agent', next: 'open with the action on the next reply' } });

function review(w: CorrectionWorld, reply: (packet: Packet) => string, now: number) {
  const states: string[] = [];
  const worker = createJournalWorker(w.journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, timeZone: 'America/Los_Angeles',
    send: async () => 7, model: async () => JSON.stringify({ reply: 'Noted.', memory: [] }),
    retrospect: async (state: string) => { states.push(state); return { state: 'complete' as const, value: reply(JSON.parse(state) as Packet),
      usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true as const } }; } });
  return { worker, states, operator: (turn: Turn) => w.operator(turn) };
}

describe('correction candidates through the retrospective review', () => {
  it('presents a crossing cluster in the packet, records it on the reservation, accepts a recurrence finding citing it, and retires it', async () => {
    const w = correctionWorld();
    try {
      seed(w);
      const now = T('2026-05-10T00:00:00Z');
      expect(correctionCandidates(w.view, w.operator, now).candidates).toHaveLength(1);
      const r = review(w, packet => answerWith(packet, [recurrence(packet.correctionCandidates![0]!)]), now);
      await r.worker.retrospect(DIGEST);
      const packet = JSON.parse(r.states[0]!) as Packet;
      expect(packet.correctionCandidates).toHaveLength(1);
      const candidate = packet.correctionCandidates![0]!;
      expect(candidate).toMatchObject({ kind: 'user-preference', learning: 'lead with the one action' });
      expect(candidate.occurrences).toHaveLength(4);
      expect(String(RETROSPECTIVE_QUESTION)).toContain('correctionCandidates');
      // The reservation row is the durable route event, and the pass recorded the owned root-cause finding.
      const pass = w.view.retroPasses[0]!;
      expect(pass.state).toBe('complete');
      expect(pass.corrections).toEqual([{ id: candidate.id, kind: 'user-preference', keys: candidate.keys }]);
      expect(pass.result!.findings).toHaveLength(1);
      expect(pass.result!.findings[0]).toMatchObject({ duty: 'recurrence', recurs: [candidate.id], refs: candidate.occurrences, disposition: { owner: 'agent' } });
      expect(openFindings(w.view).map(item => item.duty)).toEqual(['recurrence']);
      const after = correctionLifecycle(w.view, w.operator, now + 1000);
      expect(after.map(record => record.status)).toEqual(['acted-on']);
      expect(after[0]!.routeClusterId).toBe(candidate.id);
      expect(presentedCorrections(w.view)).toEqual([{ id: candidate.id, kind: 'user-preference', keys: candidate.keys, pass: 0, at: now }]);
      expect(correctionCandidates(w.view, w.operator, now + 1000).candidates).toEqual([]);
      // A restart replays the same presentation and lifecycle.
      w.reopen();
      expect(presentedCorrections(w.view)).toHaveLength(1);
      expect(correctionLifecycle(w.view, w.operator, now + 1000).map(record => record.status)).toEqual(['acted-on']);
    } finally { w.close(); }
  }, 60_000);

  it('refuses a recurrence finding that cites a candidate the packet never carried, and a packet with no crossing cluster carries no field', async () => {
    const w = correctionWorld();
    try {
      seed(w);
      const now = T('2026-05-10T00:00:00Z');
      const forged = { id: 'correction:deadbeefdeadbeef', kind: 'user-preference', keys: [], occurrences: ['turn:telegram:12345678:update:1'], learning: '', context: [] };
      const r = review(w, packet => answerWith(packet, [recurrence(forged)]), now);
      await r.worker.retrospect(DIGEST);
      const pass = w.view.retroPasses[0]!;
      expect(pass.state).toBe('complete');
      expect(pass.result!.findings).toEqual([]);
      expect(pass.result!.duties.find(row => row.duty === 'recurrence')?.disposition).toBe('unavailable');
      // Presented is presented: the cluster was in the packet, so it is acted-on even though the finding was refused.
      expect(correctionLifecycle(w.view, w.operator, now + 1000).map(record => record.status)).toEqual(['acted-on']);
      // Below the gate nothing rides the packet, and the reservation records nothing (byte-identical to before).
      const v = correctionWorld();
      try {
        v.preference('lead with the one action', T('2026-05-01T10:00:00Z'));
        v.preference('lead with the one action', T('2026-05-02T10:00:00Z'));
        const quiet = review(v, packet => answerWith(packet, []), now);
        await quiet.worker.retrospect(DIGEST);
        expect(quiet.states).toHaveLength(1);
        expect(quiet.states[0]).not.toContain('correctionCandidates');
        expect(v.view.retroPasses[0]!.corrections).toBeUndefined();
      } finally { v.close(); }
    } finally { w.close(); }
  }, 60_000);
});
