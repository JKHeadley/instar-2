import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { createJournalWorker, openPreviewJournal, type Turn } from './journal.js';

const p95 = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]!;

it('profiles full turns at 2000 turns with every memory source', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'recall-latency-')));
  const journal = openPreviewJournal(join(root, 'journal.enc'), new Uint8Array(32).fill(7), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'offline',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 3000,
    maxReplies: 3000, maxTurns: 3000, maxBytes: 32768, cursor: 0,
  });
  try {
    const view = journal.view;
    for (let i = 1; i <= 2000; i++) {
      const text = `Turn ${i}: Sam shared the cedar project plan and locker note ${i}.`;
      const turn: Turn = { id: `telegram:12345678:update:${i}`, update: i, text,
        raw: JSON.stringify({ message: { from: { id: 7654321 }, date: 1790000000 + i } }),
        accepted: true, at: 1790000000000 + i * 1000, ...(i % 3 === 0 ? { thread: 7 } : {}),
        reserved: true, answer: `I remember the cedar plan ${i}.`,
        intent: `PREVIEW — I remember the cedar plan ${i}.`, sent: i, checked: [] };
      view.order.push(turn); view.turns.set(turn.id, turn);
    }
    view.summaries.push({ kind: 'summary', through: 1990, text: 'Sam and the cedar project plan are remembered.', at: 1790002000000 });
    for (let i = 1; i <= 100; i++) {
      const source = view.order[i * 15]!.id;
      view.people.push({ name: `Sam ${i}`, source, quote: 'Sam shared the cedar project plan' });
      view.commitments.push({ in: 'message', source, quote: 'cedar project plan' });
    }
    for (let i = 1; i <= 10; i++) view.memory.push({ mode: 'correct', source: view.order[i * 100]!.id,
      quote: `locker note ${i * 100}`, trigger: view.order[i * 100 + 1]!.id,
      replacement: `locker note corrected ${i}` });
    for (let i = 1; i <= 100; i++) view.channelItems.set(JSON.stringify(['email', 'agent@example.invalid', `mail-${i}`]), { source: 'email', account: 'agent@example.invalid',
      id: `mail-${i}`, from: 'sam@example.invalid', at: 1790000000000 + i * 1000,
      subject: 'Cedar project', text: `Sam sent cedar project mail ${i}` });
    const worker = createJournalWorker(journal, { now: () => 1790003000000, stopped: () => false,
      model: async () => 'I remember the cedar plan.', send: async () => 1, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => performance.now(), jev: async () => ({ latencyMs: 0,
        value: { model: 'jev-1.13.0', answers: Object.fromEntries([
          'raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint', 'quits_on_self',
          'claims_blocked', 'parks_on_user',
        ].map(id => [id, { type: 'noul', noul: 0 }])) } }),
      escalate: async () => { throw Error('Jev should pass'); } } });
    view.limits.maxBytes = 1_000_000;
    const compact = worker.probe('What did Sam say about the cedar project?');
    expect('context' in compact && JSON.parse(compact.context).historyMode).toBe('summary-plus-recent');
    view.limits.maxBytes = 32768;
    const summary = view.summaries.pop()!;
    expect(worker.probe('What did Sam say about the cedar project?')).toEqual({ reason: 'context overflow' });
    view.summaries.push(summary);
    const samples: number[] = [];
    let packetHash = '';
    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      const result = worker.probe('What did Sam say about the cedar project?');
      samples.push(performance.now() - start);
      expect('context' in result).toBe(true);
      if ('context' in result) packetHash = createHash('sha256').update(result.context).digest('hex');
    }
    // int12 re-pin: person-attribute instructions, people-facts relevance selection, and relevance-gated
    // conflict/fact-update/held/exact-unit guidance changed this packet. Simplify re-pin: every retained
    // person note is now eligible (no active/archive partition), so single-term "Sam N" names match mail; the
    // compacted answer contract and single compact summary changed the bytes again.
    // int13 re-pin: diffed against int12's packet, only the capability line (requested reminders and
    // summaries replace the retired morning-reminder grant) and datedDecision's remind:true clause changed.
    // cbuild-1 re-pin: only the capability field changed; its hand-written capability list moved to the
    // generated capability-note source (Rules 78, 84).
    expect(packetHash).toBe('392e1cdf97520a326beaa8f8d5927af626af7af280554463ce32ff2459109cda');
    process.stdout.write(`recall latency 2000 turns all memory: probe p95=${p95(samples).toFixed(2)} ms packet=${packetHash}\n`);
    const turnSamples: number[] = [];
    const intakeSamples: number[] = [], drainSamples: number[] = [], coherenceSamples: number[] = [];
    for (let i = 2001; i <= 2020; i++) {
      const start = performance.now();
      worker.intake([{ update_id: i, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text: 'What did Sam say about the cedar project?' } }]);
      const afterIntake = performance.now();
      await worker.drain();
      const afterDrain = performance.now();
      worker.checkCoherence();
      const afterCoherence = performance.now();
      turnSamples.push(afterCoherence - start);
      intakeSamples.push(afterIntake - start); drainSamples.push(afterDrain - afterIntake);
      coherenceSamples.push(afterCoherence - afterDrain);
      expect(view.order.at(-1)?.sent).toBe(1);
    }
    process.stdout.write(`recall latency 2000 turns all memory: full non-model turn p95=${p95(turnSamples).toFixed(2)} ms (intake ${p95(intakeSamples).toFixed(2)}, drain ${p95(drainSamples).toFixed(2)}, coherence ${p95(coherenceSamples).toFixed(2)})\n`);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 120000);
