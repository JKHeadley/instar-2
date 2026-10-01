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
    for (let i = 1; i <= 100; i++) view.channelItems.set(JSON.stringify(['conversation', 'agent@example.invalid', `mail-${i}`]), { source: 'conversation', account: 'agent@example.invalid',
      id: `mail-${i}`, from: 'sam@example.invalid', at: 1790000000000 + i * 1000, text: `Sam sent cedar project mail ${i}` });
    const worker = createJournalWorker(journal, { now: () => 1790003000000, stopped: () => false,
      model: async () => 'I remember the cedar plan.', send: async () => 1, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => performance.now(), jev: async () => ({ latencyMs: 0,
        value: { model: 'jev-1.13.0', answers: Object.fromEntries([
          'raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint', 'quits_on_self',
          'claims_blocked', 'parks_on_user', 'defers_work', 'unrecorded_blocker',
        ].map(id => [id, { type: 'noul', noul: 0 }])) } }),
      escalate: async () => { throw Error('Jev should pass'); } } });
    view.limits.maxBytes = 1_000_000;
    const compact = worker.probe('What did Sam say about the cedar project?');
    expect('context' in compact && JSON.parse(compact.context).historyMode).toBe('summary-plus-recent');
    view.limits.maxBytes = 32768;
    const summary = view.summaries.pop()!;
    // Without the summary, complete history no longer fits: like a real turn, the probe reaches the floor and
    // says so (recent-only, with the set-aside counted), rather than reporting a size hold (Rules 26, 95).
    const floored = worker.probe('What did Sam say about the cedar project?');
    expect('context' in floored && JSON.parse(floored.context)).toMatchObject({ historyMode: 'recent-only',
      historySetAside: { count: expect.any(Number) } });
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
    // cbuild-2 re-pin: every verified operator packet now carries the summary-scheduling decision and
    // bounded memory search without keyword prerequisites (Rule 10), and summarized packets report
    // meaningIndexCoverage (Rule 11); the memory decision notes that undo exists only via undoDecision.
    // cbuild-2 repair re-pin: removing only `continuity` (Rule 110's note for a not-yet-accounted summary
    // frontier) and `meaningIndexCoverage.disposition` reproduces the prior pin 24e81794…f9d026 exactly.
    // cbuild-4 re-pin: this operator packet now carries the obligation guide (directives, open loops,
    // governed blocker records) and the governing-constraint keys; nothing else in it changed.
    // cbuild-4 repair 2 re-pin: diffed against repair 1's packet, only two guide sentences changed: the capability
    // line explains an item's need/progress, and the blocker contract drops "tried" for capability-key evidence.
    // cint-2 re-pin (cbuild-2 merged over cbuild-4): diffed field by field against both parents' packets
    // (583bf4b6… and 3f4a1662…), every field equals the side that changed it, and the capability line is
    // exactly the union of both builds' sentences (nothing lost, nothing new).
    // cint-23-occam re-pin: the email import route and the cross-topic digest were removed. The fixture's
    // channel items are conversation items (no email subject). Run on the base code with that same fixture,
    // the packet differs only by the absent crossTopicDigest and the memorySearch items that use its room.
    // cint-23-occam step 2 re-pin: diffed field by field against step 1's packet, only three fields changed: the
    // summaryDecision is gone, and the capability line and datedDecision describe requested actions generally.
    // cint-1 live repair re-pin: only the obligation guide's wording (reply sentences copied word for word, one
    // packet.capabilities key as evidence) and the added capabilities key changed.
    // cint-L2 merge of the live repair: diffed field by field against both parents' packets (9bb4bf29… and
    // 4895ab42…), obligationDecision and capabilities equal the live repair's and every other field equals cint-L2's.
    // cint-L3 re-pin (cint-4 and cint-5 merged onto cint-L2): diffed field by field against cint-L2's packet (dcb8aa24…,
    // reproduced on 9f890018), only the capability field changed, 4021 → 3550 bytes: build 1 moved its hand-written
    // capability list to the generated capability-note source (Rules 78, 84). Every other field equals cint-L2's.
    // cint-L4 group B re-pin (Rule 29): only datedDecision's `when` clause changed (the date phrase copied word for
    // word, never converted); reverting just that string reproduces cb0fa8dd…4baef8 exactly.
    // w3-memcorr re-pin (Rule 7, live K13b): only memoryDecision changed (it states the exact memory item shape);
    // the base journal.ts on this same test reproduces 84c8b0fb…ddfea7 exactly.
    expect(packetHash).toBe('439c568d50acc84e326b555a4b67e6d2ed72baf56107b01d5a23604b181411d0');
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
