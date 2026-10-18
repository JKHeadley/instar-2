import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OBLIGATION_DECISION, OBLIGATION_DECISION_FLOOR, OBLIGATION_DECISION_NONE, concurrentWorkItem,
  createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';

/** Why this file exists: live 2026-10-03 (proof room one, build cint-L38b 5257ddcf), a default-size root under byte
 * pressure dropped the whole obligation guide, so "From now on, end every gift list with "— D60"." was answered "Got it
 * — from now on I'll end every gift list with "— D60"" and nothing was recorded (Rules 3, 93). The guide now yields to
 * its floor form; only on the last rung, when not even that fits, does it give way to a clause telling the model that
 * nothing can be declared, so the reply cannot claim a save. This drives the real ladder with a message that grows
 * until no rung fits, and holds the order and both sides of each boundary. The recorded-shape replay is in
 * default-root-conversation.test.ts. */

const key = new Uint8Array(32).fill(59);
const now = 1_790_500_000_000;
const LIMIT = 20_000;
const bytes = (value: string) => Buffer.byteLength(value);
const message = (size: number) => `From now on, end every gift list with "— D60". ${'x'.repeat(size)}`;

it('keeps a declaration clause on every rung, and gives up the floor form only when it cannot fit', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-floor-duty-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9_999_999_999_999, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: LIMIT, cursor: 0 });
    // The operator's message is the prompt's question, not packet bytes, so the real envelope measures the whole prompt.
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now, LIMIT),
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {},
      concurrentWork: () => concurrentWorkItem({ now, others: [], scanned: 1, truncated: false, unreadable: 0,
        current: { owner: 'preview-root', launch: now - 60_000, conversation: 'telegram/bot-12345678/chat-7654321' } }) });
    const rungs: { size: number; rung: string; packet?: Record<string, unknown>; context?: string; prepared?: string }[] = [];
    for (let size = 0; size <= LIMIT; size += 25) {
      const probe = worker.probe(message(size));
      if ('reason' in probe) { rungs.push({ size, rung: 'unanswerable' }); continue; }
      const packet = JSON.parse(probe.context) as Record<string, unknown>;
      const guide = packet.obligationDecision;
      rungs.push({ size, packet, context: probe.context, prepared: String(probe.prepared), rung: guide === OBLIGATION_DECISION ? 'full'
        : guide === OBLIGATION_DECISION_FLOOR ? 'floor' : guide === OBLIGATION_DECISION_NONE ? 'none' : 'absent' });
    }
    // A packet the agent answers from always carries a declaration clause (the recorded failure was 'absent').
    expect(rungs.filter(item => item.rung === 'absent')).toEqual([]);
    // Every rung is reached, in order, as the message grows: full guide, floor form, no-declaration clause, no packet.
    const order = rungs.map(item => item.rung).filter((rung, index, all) => rung !== all[index - 1]);
    expect(order).toEqual(['full', 'floor', 'none', 'unanswerable']);
    // The floor form is chosen while the concurrent-work view still fits beside it, and that view goes first after.
    const floors = rungs.filter(item => item.rung === 'floor');
    expect(floors.some(item => 'concurrentWork' in item.packet!)).toBe(true);
    expect(floors.some(item => !('concurrentWork' in item.packet!))).toBe(true);
    // Both sides of the last boundary: every no-declaration prompt is one the floor form would not have fit (that prompt
    // plus the floor form's extra prepared bytes is over the limit), and every floor prompt fits it.
    const system = bytes(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
    const envelope = (size: number, context: string) => bytes(prepareJournalEnvelope({ question: message(size), context,
      id: 'telegram:12345678:update:0' }, 'claude-sonnet-5', 'grant:preview', now, Infinity));
    const nones = rungs.filter(item => item.rung === 'none');
    expect(nones.length).toBeGreaterThan(0);
    for (const item of nones) {
      expect('concurrentWork' in item.packet!).toBe(false);
      const extra = envelope(item.size, JSON.stringify({ ...item.packet, obligationDecision: OBLIGATION_DECISION_FLOOR }))
        - envelope(item.size, item.context!);
      expect(extra).toBeGreaterThan(0);
      expect(bytes(item.prepared!) + system + extra, `size ${String(item.size)}`).toBeGreaterThan(LIMIT);
    }
    for (const item of floors) expect(bytes(item.prepared!) + system).toBeLessThanOrEqual(LIMIT);
    // The floor form keeps the same declarations the full guide asks for, with the evidence and constraint keys that
    // the capability and constraint tables carried, so a blocker it produces is still admissible.
    for (const field of ['directives:', 'closeDirectives:', 'openLoops:', 'blocker:', '"externalTools"', '"no-tools"', 'recheck:'])
      expect(OBLIGATION_DECISION_FLOOR, field).toContain(field);
    expect(bytes(OBLIGATION_DECISION_FLOOR)).toBeLessThan(bytes(OBLIGATION_DECISION));
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);
