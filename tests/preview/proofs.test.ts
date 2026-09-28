// Build 9: due plans, their probes and Nine's posture over the durable records (Rules 9, 26, 38, 43, 73).
import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import type { JournalView } from './journal.js';
import { CRITICAL_PIPELINES, PREVIEW_PROOF_PLANS, executeProof, journalFingerprint, nextDuePlan, planVersion, proofPosture, stepCoverage } from './proofs.js';
import type { ProofPorts, ProofRecord } from './proofs.js';
import { appendProof, readProofs } from './proof-log.js';

const key = new Uint8Array(32).fill(29);
const T0 = 1790000000000, MINUTE = 60_000, HOUR = 60 * MINUTE;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 50, maxReplies: 50, maxTurns: 50, maxBytes: 8000, cursor: 0 };
const plan = (id: string) => PREVIEW_PROOF_PLANS.find(p => p.id === id)!;
const supervisors = { replyReview: true, summaryReview: true, stepCheck: false };

async function world(options: { review?: boolean } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-proofs-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  const clock = { now: T0 };
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'UTC',
    prepareModel: input => input.context, model: async () => 'Noted.',
    send: async () => 7, checkOutbound: () => {},
    ...(options.review ? { replyCheck: { elapsedMs: () => clock.now, jev: async () => ({ value: { model: 'jev-1.13.0', answers: {} }, latencyMs: 1 }),
      escalate: async () => ({ verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 1, reason: 'fine' }) } } : {}) });
  let next = 1;
  const say = async (text: string) => {
    worker.intake([{ update_id: next++, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  const ports = (extra: Partial<ProofPorts> = {}): ProofPorts => ({ now: () => clock.now, liveView: () => journal.view,
    durableView: () => { const copy = openPreviewJournal(path, key, undefined, undefined, true); try { return copy.view; } finally { copy.close(); } },
    botIdentity: () => ({ id: 12345678 }), boundBot: 12345678, supervisors, ...extra });
  return { root, path, journal, clock, say, ports };
}
const record = (id: string, at: number, disposition: ProofRecord['disposition'], generation = 'g1'): ProofRecord =>
  ({ v: 1, plan: id, planVersion: planVersion(plan(id)), generation, startedAt: at, completedAt: at, disposition, observed: {}, detail: '' });

describe('posture and due work through Nine derivations', () => {
  it('distinguishes never-run, healthy, failed, stale, not-current and inactive', () => {
    const at = (records: ProofRecord[], now: number, generation = 'g1', ports = { supervisors }) =>
      new Map(proofPosture(PREVIEW_PROOF_PLANS, records, generation, ports, now).map(row => [row.plan, row]));
    expect(at([], T0).get('journal-restore')).toMatchObject({ posture: 'unknown', last: null, overdueBy: T0 });
    const passed = at([record('journal-restore', T0, 'passed')], T0 + HOUR).get('journal-restore')!;
    expect(passed).toMatchObject({ posture: 'healthy', lastSuccessAt: T0, dueAt: T0 + 6 * HOUR, overdueBy: 0 });
    expect(at([record('journal-restore', T0, 'passed'), record('journal-restore', T0 + HOUR, 'failed')], T0 + 2 * HOUR).get('journal-restore')!.posture).toBe('failed');
    expect(at([record('journal-restore', T0, 'unknown')], T0 + HOUR).get('journal-restore')!.posture).toBe('unknown');
    expect(at([record('journal-restore', T0, 'passed')], T0 + 13 * HOUR).get('journal-restore')!.posture).toBe('stale');
    // A record from another code generation is history, not current proof.
    expect(at([record('journal-restore', T0, 'passed', 'g0')], T0 + HOUR).get('journal-restore')!.posture).toBe('unknown');
    const stepOff = at([], T0).get('step-check-reached')!;
    expect(stepOff).toMatchObject({ required: false, posture: 'inactive', overdueBy: 0 });
    expect(at([], T0, 'g1', { supervisors: { ...supervisors, stepCheck: true } }).get('step-check-reached')!.required).toBe(true);
  });
  it('the executor takes one most-overdue cadence plan and never a launch plan', () => {
    expect(nextDuePlan(PREVIEW_PROOF_PLANS, [], 'g1', { supervisors }, T0)!.trigger).toBe('cadence');
    const everyCadence = PREVIEW_PROOF_PLANS.filter(p => p.trigger === 'cadence').map(p => record(p.id, T0, 'passed'));
    expect(nextDuePlan(PREVIEW_PROOF_PLANS, everyCadence, 'g1', { supervisors }, T0 + MINUTE)).toBeNull();
    expect(nextDuePlan(PREVIEW_PROOF_PLANS, everyCadence, 'g1', { supervisors }, T0 + 15 * MINUTE)!.id).toBe('reply-drain');
    // A failed or unknown attempt is due again only after its cadence: no retry storm.
    expect(nextDuePlan(PREVIEW_PROOF_PLANS, everyCadence.map(r => ({ ...r, disposition: 'failed' as const })), 'g1', { supervisors }, T0 + MINUTE)).toBeNull();
  });
  it('a probe that cannot observe is recorded unknown, never passed', () => {
    const broken = { ...plan('journal-restore'), probe: () => { throw Error('unreadable'); } };
    const ports = { now: () => T0, liveView: () => { throw Error('x'); }, durableView: () => { throw Error('x'); }, botIdentity: () => null,
      boundBot: 1, supervisors } as unknown as ProofPorts;
    expect(executeProof(broken, ports, 'g1', () => 0)).toMatchObject({ disposition: 'unknown', observed: {} });
  });
});

describe('probes observe underlying state', () => {
  it('journal restore passes on an equal replay and fails on a differing or unreadable one', async () => {
    const w = await world();
    await w.say('hello there');
    expect(plan('journal-restore').probe(w.ports()).disposition).toBe('passed');
    const stale = { ...journalFingerprint(w.journal.view) };
    const differing = w.ports({ durableView: () => ({ ...w.journal.view, cursor: w.journal.view.cursor - 1 }) as JournalView });
    expect(plan('journal-restore').probe(differing)).toMatchObject({ disposition: 'failed', observed: { differing: 'cursor' } });
    expect(plan('journal-restore').probe(w.ports({ durableView: () => { throw Error('corrupt'); } })).disposition).toBe('failed');
    expect(journalFingerprint(w.journal.view)).toEqual(stale);
    w.journal.close();
  });
  it('bot identity passes only for the bound bot, and no answer is unknown', async () => {
    const w = await world();
    expect(plan('telegram-identity').probe(w.ports()).disposition).toBe('passed');
    expect(plan('telegram-identity').probe(w.ports({ botIdentity: () => ({ id: 999 }) })).disposition).toBe('failed');
    expect(plan('telegram-identity').probe(w.ports({ botIdentity: () => null })).disposition).toBe('unknown');
    w.journal.close();
  });
  it('reply review reached: passes when every sent answer passed review, fails when one did not, unknown with none', async () => {
    const unreviewed = await world();
    expect(plan('reply-review-reached').probe(unreviewed.ports()).disposition).toBe('unknown');
    await unreviewed.say('what is the weather like');
    expect(plan('reply-review-reached').probe(unreviewed.ports())).toMatchObject({ disposition: 'failed', observed: { unreviewed: 1 } });
    unreviewed.journal.close();
    const reviewed = await world({ review: true });
    await reviewed.say('what is the weather like');
    expect(plan('reply-review-reached').probe(reviewed.ports())).toMatchObject({ disposition: 'passed', observed: { sentAnswers: 1, reviewed: 1 } });
    reviewed.journal.close();
  });
  it('reply drain fails only on overdue accepted work with nothing inhibiting it', async () => {
    const w = await world();
    expect(plan('reply-drain').probe(w.ports()).disposition).toBe('passed');
    const view = w.journal.view;
    const waiting = { ...view, order: [{ id: 'x', update: 1, text: 'hi', raw: '', accepted: true, at: T0, reserved: false }] } as unknown as JournalView;
    w.clock.now = T0 + HOUR;
    expect(plan('reply-drain').probe(w.ports({ liveView: () => waiting })).disposition).toBe('failed');
    expect(plan('reply-drain').probe(w.ports({ liveView: () => ({ ...waiting, stop: 'operator' }) as JournalView }))).toMatchObject({
      disposition: 'passed', observed: { inhibition: 'operator' } });
    w.journal.close();
  });
  it('provider outcomes: unknown before any call, failed when the latest calls all failed', async () => {
    const w = await world();
    expect(plan('provider-outcomes').probe(w.ports()).disposition).toBe('unknown');
    const call = (subtype: string) => ({ kind: 'call-outcome', id: 'c', role: 'model', at: T0,
      outcome: { exitCode: 0, localLimit: null, elapsedMs: 1, type: 'result', subtype, isError: subtype !== 'success', outputTokens: 1, promptBytes: 1 } });
    const failing = { ...w.journal.view, callOutcomes: [call('success'), call('other'), call('other'), call('other')] } as unknown as JournalView;
    expect(plan('provider-outcomes').probe(w.ports({ liveView: () => failing })).disposition).toBe('failed');
    const recovering = { ...failing, callOutcomes: [...failing.callOutcomes, call('success')] } as unknown as JournalView;
    expect(plan('provider-outcomes').probe(w.ports({ liveView: () => recovering })).disposition).toBe('passed');
    w.journal.close();
  });
});

describe('every critical pipeline step reaches its supervisor or names its deterministic exception (Rule 38)', () => {
  it('a consequential send is not covered by the deterministic floor alone', async () => {
    const unreviewed = await world();
    await unreviewed.say('what is the weather like');
    const rows = stepCoverage(unreviewed.journal.view, supervisors)['operator-reply']!;
    expect(rows.find(r => r.boundary === 'send')!.state).toBe('unavailable');
    expect(rows.find(r => r.boundary === 'intake')!.state).toBe('validated');
    // The dark step observer contributes nothing: those boundaries show as missing, not validated.
    expect(rows.find(r => r.boundary === 'prepare-packet')!.state).toBe('missing');
    unreviewed.journal.close();
    const reviewed = await world({ review: true });
    await reviewed.say('what is the weather like');
    const covered = stepCoverage(reviewed.journal.view, supervisors);
    expect(covered['operator-reply']!.find(r => r.boundary === 'send')!.state).toBe('validated');
    expect(covered['requested-reminder']!.every(r => r.state === 'validated')).toBe(true);
    expect(Object.keys(covered)).toEqual(Object.keys(CRITICAL_PIPELINES));
    reviewed.journal.close();
  });
});

it('the proof log keeps valid rows and counts torn or malformed ones', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-proof-log-')));
  const path = join(root, 'proofs.jsonl');
  appendProof(path, record('journal-restore', T0, 'passed'));
  appendProof(path, { v: 1, liveProof: 'live-proof:preview.reply', capability: 'preview.reply', version: 'v', fact: 'reply-accepted', update: 1, messageId: 3, recordedAt: T0 });
  appendFileSync(path, '{"v":1,"plan":"x","planVersion":"v","generation":"g","startedAt":5,"completedAt":4,"disposition":"passed","observed":{},"detail":""}\n{"v":1,"plan":');
  const log = readProofs(path);
  expect(log.proofs).toHaveLength(1);
  expect(log.liveProofs).toHaveLength(1);
  expect(log.unreadable).toBe(2);
  writeFileSync(path, '');
  expect(readProofs(join(root, 'absent.jsonl'))).toEqual({ proofs: [], liveProofs: [], unreadable: 0 });
});
