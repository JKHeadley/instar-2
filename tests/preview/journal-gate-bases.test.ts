import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { capacityRefused, createJournalWorker, MINIMAL_POLL_LIMIT, MINIMAL_RESERVE, openPreviewJournal } from './journal-test-worker.js';
import type { JournalRecord } from './journal.js';

const key = new Uint8Array(32).fill(29);
const genesis = { kind: 'genesis' as const, bot: '123', chat: '456', operator: '456', grant: 'trial',
  configurationDigest: 'sha256:trial', expires: 2000, cursor: 0, maxCalls: 4, maxReplies: 4, maxTurns: 4, maxBytes: 32768 };
const intake = { kind: 'intake' as const, id: 'telegram:123:update:1', update: 1, text: 'question',
  raw: '{}', accepted: true, cursor: 2, at: 1000 };

it('separates emergency stop from expiry and keeps every ordinary capacity from ending polling', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gate-bases-')));
  const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
  let stopped = false, now = 1999;
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => stopped,
    model: async () => { throw Error('no model call expected'); }, send: async () => { throw Error('no send expected'); }, checkOutbound: () => {} });
  try {
    expect(() => worker.gate()).not.toThrow();
    expect(worker.pollLimit()).toBe(MINIMAL_POLL_LIMIT);
    for (const field of ['maxCalls', 'maxReplies', 'maxTurns', 'maxBytes'] as const) {
      const before = journal.view.limits[field];
      journal.view.limits[field] = 0; // Isolated observation: even exhausted capacity cannot stop polling.
      expect(worker.pollLimit()).toBe(MINIMAL_POLL_LIMIT);
      expect(() => worker.pollGate()).not.toThrow();
      journal.view.limits[field] = before;
    }
    stopped = true;
    expect(() => worker.gate()).toThrow('preview stopped');
    expect(() => worker.pollGate()).toThrow('preview stopped');
    expect(journal.view.stop).toBeNull();
    stopped = false;
    expect(() => worker.gate()).not.toThrow();
    now = 2000;
    expect(() => worker.pollGate()).toThrow('preview stopped');
    expect(journal.view.stop).toBe('trial expired');
    expect(() => worker.gate()).toThrow('preview stopped');
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('exercises both sides of every non-spend capacity branch and the separate Jev spend boundary', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'capacity-bases-')));
  const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
  try {
    const view = journal.view;
    // Seed one real projected turn; boundary observations below are copies, never live writes.
    journal.append(intake);
    const turn = view.order[0]!;
    const full = { ...view, limits: { ...view.limits, maxTurns: 1 } };
    const next = { ...intake, id: 'telegram:123:update:2', update: 2 };
    expect(capacityRefused(view, next)).toBe(false);
    expect(capacityRefused(full, next)).toBe(true);
    expect(capacityRefused(full, intake)).toBe(false); // Existing input is not discarded.
    const due: JournalRecord = { kind: 'action-due', id: 'due:1', items: [], update: 2, at: 1000 };
    expect(capacityRefused(view, due)).toBe(false);
    expect(capacityRefused(full, due)).toBe(true);
    expect(capacityRefused(view, { ...next, reserve: true })).toBe(true);
    expect(capacityRefused(full, { ...next, reserve: true })).toBe(false);
    const used = Array.from({ length: MINIMAL_RESERVE.turns }, (_, i) => ({ ...turn, id: `reserved:${i}`, reserve: true as const }));
    const reserveFull = { ...full, order: used };
    expect(capacityRefused(reserveFull, { ...next, reserve: true })).toBe(true);
    expect(capacityRefused({ ...reserveFull, order: used.slice(1) }, { ...next, reserve: true })).toBe(false);
    expect(capacityRefused(reserveFull, { ...next, reserve: true, accepted: false })).toBe(false);
    expect(capacityRefused(reserveFull, { ...next, reserve: true, at: 1000 + MINIMAL_RESERVE.windowMs })).toBe(false);
    const intent: JournalRecord = { kind: 'intent', id: turn.id, text: 'reply', chat: '456', update: 1, grant: 'trial', at: 1000 };
    expect(capacityRefused({ ...view, replies: 3 }, intent)).toBe(false);
    expect(capacityRefused({ ...view, replies: 4 }, intent)).toBe(true);
    const limited: JournalRecord = { kind: 'limited-intent', id: turn.id, covers: [turn.id], reason: 'turns',
      text: 'held', chat: '456', grant: 'trial', at: 1000 };
    const replied = Array.from({ length: MINIMAL_RESERVE.replies }, (_, i) => ({ ...turn, id: `limited:${i}`,
      limited: { text: 'held', lead: `limited:${i}`, reason: 'turns' as const, at: 1000 } }));
    expect(capacityRefused({ ...view, order: replied.slice(1) }, limited)).toBe(false);
    expect(capacityRefused({ ...view, order: replied }, limited)).toBe(true);
    expect(capacityRefused({ ...view, order: replied }, { ...limited, at: 1000 + MINIMAL_RESERVE.windowMs })).toBe(false);
    const stopApproval = { action: 'stop' as const, base: 'base', id: 'request' };
    expect(capacityRefused({ ...view, order: replied }, { ...limited, approval: stopApproval })).toBe(false);
    const jev: JournalRecord = { kind: 'reply-jev-reserve', id: turn.id, at: 1000 };
    expect(capacityRefused({ ...view, jevChecks: 3 }, jev)).toBe(false);
    expect(capacityRefused({ ...view, jevChecks: 4 }, jev)).toBe(true);
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});
