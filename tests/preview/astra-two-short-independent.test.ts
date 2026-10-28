import { expect, it } from 'vitest';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, pendingReports } from './journal-test-worker.js';

// Synthetic encoding boundary derived from the archived middle-report reproduction.
// Ten 1490-byte reports surround two smaller reports: ordinary text and escape-heavy text.
it.each([29642, 409600])('two short middle reports remain reachable through the actual %s-byte envelope', async budget => {
  const tight = budget !== 409600; let guidance = '';
  let preparedInput: Parameters<typeof prepareJournalEnvelope>[0] | undefined;
  const root = mkdtempSync(join(tmpdir(), 'astra-report-backlog-'));
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(85), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'offline',
    configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 200, maxReplies: 200, maxTurns: 200, maxBytes: budget, cursor: 0, loopRevisitMs: 600000 });
  let now = 1793160000000, answer = '', update = 1;
  const packets: { pendingReports?: { items: { key: string; text: string }[] }; pendingReportsOmitted?: number }[] = [];
  const sent: string[] = [];
  let pressure = false; let pressureCalls = 0; let preparations = 0;
  const stale = ('An old unverified capability assertion. '.repeat(40)).slice(0, 1490).trim();
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    prepareModel: input => {
      if (pressure) preparations++;
      guidance = JSON.parse(input.context).pendingReports?.guidance ?? guidance;
      const prepared = prepareJournalEnvelope(input, 'claude-sonnet-5', 'offline', now, budget);
      preparedInput = input; return prepared;
    },
    model: async input => {
      if (input.id.startsWith('obligation:')) {
        const q = JSON.parse(input.context).obligation.quote;
        return JSON.stringify({ outcome: 'report', report: q.includes('task 5.') ? 'The requested label is Home.' + 'a'.repeat(1000) : q.includes('task 6.') ? String.fromCharCode(92).repeat(500) : stale });
      }
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier tasks remain owed.', people: [], commitments: [], closed: [], memory: [] });
      const packet = JSON.parse(input.context); packets.push(packet);
      if (pressure) {
        const remaining = pendingReports(journal.view);
        const envelopeInput = preparedInput!;
        const alternative = { ...packet, pendingReports: { guidance, items: remaining.filter(item => item.key === 'commitment:5') }, pendingReportsOmitted: remaining.length - 1 };
        let fits = true;
        try { prepareJournalEnvelope({ ...envelopeInput, context: JSON.stringify(alternative) }, 'claude-sonnet-5', 'offline', now, budget); } catch { fits = false; }
        if (pressureCalls++ === 0) expect(fits, 'supported singleton fits the exact first packet and actual envelope').toBe(true);
        console.log('ASTRA short-only alternative', JSON.stringify({ fits, itemBytes: remaining.filter(item => ['commitment:5', 'commitment:6'].includes(item.key)).map(item => ({ key: item.key, bytes: Buffer.byteLength(JSON.stringify(item)) })), actualOffered: packet.pendingReports?.items.map((r: {key: string}) => r.key) ?? [], actualBytesWithSystem: Buffer.byteLength(prepareJournalEnvelope(envelopeInput, 'claude-sonnet-5', 'offline', now, 409600)) + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT), alternativeBytesWithSystem: Buffer.byteLength(prepareJournalEnvelope({ ...envelopeInput, context: JSON.stringify(alternative) }, 'claude-sonnet-5', 'offline', now, 409600)) + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT) }));
      }
      if (pressure) return JSON.stringify({ reply: 'Only the label is supported by current evidence.',
        selectedReports: ['commitment:5'], rejectedReports: packet.pendingReports?.items
          .filter((item: { key: string }) => item.key !== 'commitment:5')
          .map((item: { key: string }) => ({ key: item.key, objection: 'No current evidence supports these capability claims.' })) ?? [] });
      return answer;
    }, checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return update; } });
  async function say(text: string) {
    worker.intake([{ update_id: update++, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } }]);
    await worker.drain();
  }
  try {
    for (let n = 0; n < 12; n++) {
      const quote = `I will research task ${n}.`;
      answer = JSON.stringify({ reply: quote, memory: [], openLoops: [{ kind: 'deferral', quote, waitsOn: 'nothing' }] });
      await say(`Research task ${n} later.`);
    }
    now += 601000;
    for (let n = 0; n < 30 && await worker.workObligations(); n++) {}
    expect(pendingReports(journal.view)).toHaveLength(12);
    answer = JSON.stringify({ reply: 'The label is Home. The old capability claims remain unverified.', memory: [], selectedReports: ['commitment:5'] });
    pressure = true;
    const start = packets.length;
    for (let n = 0; n < 3; n++) {
      const owed = pendingReports(journal.view).length;
      await say('Give me the verified label from task 5.');
      const packet = packets.at(-1)!;
      expect((packet.pendingReports?.items.length ?? 0) + (packet.pendingReportsOmitted ?? 0)).toBe(owed);
      if (journal.view.obligationWork['commitment:5']?.report?.delivered) break;
    }
    const offered = packets.slice(start).map(p => p.pendingReports?.items.map((r) => r.key) ?? []);
    console.log('ASTRA backlog', JSON.stringify({ owed: pendingReports(journal.view).length, preparations, offered, omitted: packets.slice(start).map(p => p.pendingReportsOmitted ?? null), lastReports: journal.view.order.at(-1)?.answerReports ?? [] }));
    if (tight) {
      expect(offered.flat()).toContain('commitment:5');
      expect(journal.view.obligationWork['commitment:5']?.report?.delivered).toBeDefined();
      journal.close();
      const reopened = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(85));
      expect(reopened.view.obligationWork['commitment:5']?.report?.delivered).toBeDefined();
      expect(pendingReports(reopened.view).some(item => item.key === 'commitment:5')).toBe(false);
      reopened.close();
    }
    expect(offered.flat(), 'supported later report must reach the model for selection').toContain('commitment:5');
    expect(journal.view.obligationWork['commitment:5']?.report?.delivered).toBeDefined();
    expect(sent.filter(text => text.includes('Follow-up on')).join()).toContain('The requested label is Home.');
    if (tight && journal.view.obligationWork['commitment:5']?.report?.delivered) {
      expect(packets[start]!.pendingReportsOmitted).toBeGreaterThan(0);
      expect(pendingReports(journal.view).some(item => item.key === 'commitment:1'),
        'an omitted report remains owed rather than being treated as rejected').toBe(true);
      expect(journal.view.obligationWork['commitment:1']?.withheld).toBeUndefined();
    }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
