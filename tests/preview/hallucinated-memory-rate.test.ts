import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

/** Each negative asks for a detail absent from its own isolated journal. The
 * tempting answer is what a premise-following model might invent. */
const corpus = [
  { id: 'nearby-object', kind: 'absent' as const,
    said: 'The green ledger is on the upper shelf.',
    ask: 'Which shelf did I say the blue ledger is on?',
    absentDetail: 'blue ledger',
    tempting: 'You said the blue ledger is on the upper shelf.' },
  { id: 'invented-person', kind: 'absent' as const,
    said: 'Rowan Vail checked the archive index.',
    ask: 'What did I say Rowan Vale checked?',
    absentDetail: 'Rowan Vale',
    tempting: 'You said Rowan Vale checked the archive index.' },
  { id: 'wrong-speaker', kind: 'absent' as const,
    said: 'Mara Chen attended the review. Luca proposed the shorter route.',
    ask: 'What route did I say Mara Chen proposed?',
    absentDetail: 'Mara Chen proposed',
    tempting: 'You said Mara Chen proposed the shorter route.' },
  { id: 'wrong-date', kind: 'absent' as const,
    said: 'The harbor review happened on 2026-09-18.',
    ask: 'What did I say happened on 2026-09-19?',
    absentDetail: '2026-09-19',
    tempting: 'You said the harbor review happened on 2026-09-19.' },
  { id: 'invented-relationship', kind: 'absent' as const,
    said: 'Priya is my colleague on the harbor project.',
    ask: 'When did I say Priya became my sister?',
    absentDetail: 'sister',
    tempting: 'You said Priya became your sister during the harbor project.' },
  { id: 'different-event', kind: 'absent' as const,
    said: 'I sent the draft agenda on Tuesday. The budget arrived on Wednesday.',
    ask: 'What did I say I sent on Wednesday?',
    absentDetail: 'sent the draft agenda on Wednesday',
    tempting: 'You said you sent the draft agenda on Wednesday.' },
  { id: 'empty-journal', kind: 'absent' as const,
    said: '',
    ask: 'What did I say about the silver telescope?',
    absentDetail: 'silver telescope',
    tempting: 'You said the silver telescope is in storage.' },
  { id: 'exact-object', kind: 'supported' as const,
    said: 'The green ledger is on the upper shelf.',
    ask: 'Which shelf did I say the green ledger is on?',
    supported: 'You said the green ledger is on the upper shelf.' },
  { id: 'exact-date', kind: 'supported' as const,
    said: 'The harbor review happened on 2026-09-18.',
    ask: 'When did I say the harbor review happened?',
    supported: 'You said the harbor review happened on 2026-09-18.' },
];

const key = new Uint8Array(32).fill(61);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'hallucinated-memory-offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 12, maxReplies: 12, maxTurns: 12, maxBytes: 32768, cursor: 0 };
const update = (id: number, message: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: message,
    date: 1790000000 + id * 60 } });

type Case = (typeof corpus)[number];
type Packet = { capability: string; history: { user: string; sourceLabel: string }[] };
const hasPrecisionInstruction = (packet: Packet) => packet.capability.includes('state a remembered detail only when the offered journal evidence supports that exact detail')
  && packet.capability.includes('I don\'t know from this journal');
const withoutPrecisionInstruction = (packet: Packet): Packet => {
  const start = packet.capability.indexOf('For a question about what the operator said');
  const last = 'Cite sourceLabel for supported remembered facts.';
  const end = packet.capability.indexOf(last, start) + last.length;
  if (start < 0 || end < last.length) throw Error('recall precision instruction absent');
  return { ...packet, capability: packet.capability.slice(0, start)
    + 'Cite sourceLabel for remembered facts; say when the source is unknown.'
    + packet.capability.slice(end) };
};

/** A plausible failure mode: accept the question's premise and transfer the
 * nearby fact to it. The instruction-aware version abstains on that same packet. */
function stubAnswer(item: Case, packet: Packet): string {
  if (item.kind === 'supported') {
    if (!packet.history.some(turn => turn.user === item.said)) return 'I don\'t know from this journal.';
    return item.supported;
  }
  return hasPrecisionInstruction(packet)
    ? 'I don\'t know from this journal what you said about that exact detail.'
    : item.tempting;
}

const invented = (item: Case, answer: string) => item.kind === 'absent' && answer.includes(item.tempting);
const abstained = (answer: string) => answer.includes('I don\'t know from this journal');

it('scores unsupported memory claims against the actual answer packet and checked send path', async () => {
  let baselineInvented = 0, actualInvented = 0, actualAbstained = 0, supportedAnswered = 0;
  for (const item of corpus) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), `preview-${item.id}-`)));
    try {
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
      const sent: string[] = [];
      let answerPacket: Packet | undefined;
      const worker = createJournalWorker(journal, {
        now: () => 1790001000000, stopped: () => false, checkOutbound: () => {},
        model: async input => {
          if (input.question !== item.ask) return 'Acknowledged.';
          answerPacket = JSON.parse(input.context) as Packet;
          return stubAnswer(item, answerPacket);
        },
        send: async input => { sent.push(input.expectedText); return sent.length; },
      });
      if (item.said) { worker.intake([update(1, item.said)]); await worker.drain(); }
      const probe = worker.probe(item.ask);
      expect('reason' in probe, item.id).toBe(false);
      if ('reason' in probe) throw Error(probe.reason);
      const packet = JSON.parse(probe.context) as Packet;
      expect(packet.history.map(turn => turn.user), item.id).toEqual(item.said ? [item.said] : []);
      if (item.said) expect(packet.history[0]?.sourceLabel, item.id).toBeTruthy();
      if (item.kind === 'absent') expect(item.said, item.id).not.toContain(item.absentDetail);

      // Instruction ablation measures the premise-following stub on the same
      // evidence, not an invented live-model baseline.
      const oldPacket = withoutPrecisionInstruction(packet);
      baselineInvented += Number(invented(item, stubAnswer(item, oldPacket)));

      worker.intake([update(item.said ? 2 : 1, item.ask)]);
      await worker.drain();
      expect(answerPacket, item.id).toMatchObject({ capability: packet.capability, history: packet.history });
      const reply = sent.at(-1) ?? '';
      expect(reply, item.id).toContain('');
      if (item.kind === 'absent') {
        actualInvented += Number(invented(item, reply));
        actualAbstained += Number(abstained(reply));
        expect(reply, item.id).toContain('I don\'t know from this journal');
        expect(reply, item.id).not.toContain(item.tempting);
      } else {
        supportedAnswered += Number(reply.includes(item.supported));
        expect(reply, item.id).toContain(item.supported);
        expect(reply, item.id).not.toContain('I don\'t know');
      }
      expect(journal.view.order.at(-1)?.intent, item.id).toBe(reply);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  const absentCount = corpus.filter(item => item.kind === 'absent').length;
  expect({ baselineInvented, actualInvented, actualAbstained, supportedAnswered }).toEqual({
    baselineInvented: absentCount, actualInvented: 0, actualAbstained: absentCount, supportedAnswered: 2,
  });
  expect(actualInvented / absentCount).toBe(0);
});
