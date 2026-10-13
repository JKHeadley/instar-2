/** Live train-6 updates 715675444/715675448: a durable fact was described as unsaved;
 * the public-send neighbour still needs authority. Captured model outputs, not invented replies. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope, toolPreparation } from './journal-envelope.js';
import { createHash } from 'node:crypto';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { readAnswer } from './answer-reading.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/inrole-memory-live-2026-10-11.json', import.meta.url), 'utf8')) as {
  cases: { update: number; id: string; raw: string; text: string; oldReply: string; output: string; memoryDecision: string; systemSha256: string }[];
};
const key = new Uint8Array(32).fill(51);
const now = 1791710494163;
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '-1004367556355', operator: '7812716706', forum: true as const,
  grant: 'grant:recorded-memory-replay', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };

for (const recorded of fixture.cases) it(`replays real update ${recorded.update} through intake, answer and restart`, async () => {
  // Preserve the real capture's digest while accounting for the sole system identity edit.
  // Check outside the model port: the worker records thrown model errors as unknown outcomes.
  const capturedSystem = SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT.replace(
    "You are an Instar 2.0 agent,", 'You are Instar,');
  expect(createHash('sha256').update(capturedSystem).digest('hex')).toBe(recorded.systemSha256);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'inrole-memory-'))), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis);
  const sent: string[] = [];
  let packetRuns = 0;
  const packets: { memoryDecision: string }[] = [];
  const persistedTexts: (string | undefined)[] = [];
  const standing = toolPreparation(() => true);
  const worker = () => createJournalWorker(journal, {
    now: () => now, stopped: () => false, toolRoute: standing.active,
    preparePacket: prepare => { packetRuns++; return standing.run(prepare); },
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, now, genesis.maxBytes),
    model: async input => {
      packets.push(JSON.parse(input.context) as { memoryDecision: string });
      // The real storage boundary, before even the answer call: reopen the actual encrypted file.
      const persisted = openPreviewJournal(path, key, undefined, undefined, true);
      try { persistedTexts.push(persisted.view.turns.get(recorded.id)?.text); }
      finally { persisted.close(); }
      const reading = readAnswer(recorded.output, { wrapped: 'accept', evidence: [recorded.id] });
      if (!reading.ok) throw Error(reading.shape);
      return reading.value;
    }, checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
  });
  try {
    const first = worker(); first.intake([JSON.parse(recorded.raw)]); await first.drain();
    // Assert outside the model port: thrown assertions there become unknown model outcomes.
    expect(packets).toHaveLength(1);
    const packet = packets[0]!;
    expect(packet.memoryDecision).toContain('Journal persists across topics/restarts');
    expect(packet.memoryDecision).toContain('Preserve attribution');
    expect(packet.memoryDecision).toContain('Else memory:[]');
    expect(packet.memoryDecision).toContain('mode:"remember"');
    expect(persistedTexts).toEqual([recorded.text]);
    expect(sent).toHaveLength(1);
    expect(packetRuns).toBeGreaterThan(0);
    expect(journal.view.operatorRequests).toHaveLength(0);
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.turns.get(recorded.id)?.text).toBe(recorded.text);
    const resumed = worker(); await resumed.drain(); expect(sent).toHaveLength(1);
    if (recorded.update === 715675444) {
      expect(recorded.oldReply).toContain('If you want it to stick, let me know');
      expect(sent[0]).toMatch(/green/iu);
      expect(sent[0]).not.toMatch(/if you want|let me know|confirm|cannot|can't/iu);
      // This historical model output has no insert. Preserve its intake without claiming a saved fact.
      expect(journal.view.memory).toEqual([]);
      const probe = resumed.probe('What is my favourite colour?');
      if ('reason' in probe) throw Error(probe.reason);
      expect(JSON.parse(probe.context).history).toEqual(expect.arrayContaining([
        expect.objectContaining({ user: recorded.text }),
      ]));
    } else {
      expect(sent[0]).toMatch(/sign.off|approv|authori[sz]|grant/iu);
      expect(sent[0]).toMatch(/public|post/iu);
      expect(sent[0]).not.toMatch(/I (?:have )?posted|I published/iu);
    }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});


it.each([false, true])('bounds authority reads on the recorded stalled packet; snapshot=%s', snapshot => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/inrole-memory-live-2026-10-11.json', import.meta.url), 'utf8')).stall;
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'inrole-packet-')));
  const journal = openPreviewJournal(join(root, 'journal'), key, genesis);
  let reads = 0, clock = now, available = true, preparations = 0;
  // Inject the measured read cost instead of rereading 135 MB per variant or burning CPU.
  const standing = toolPreparation(() => { reads++; clock += 354; return available; });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    sources: () => { standing.active(); return captured.sources; }, toolRoute: () => standing.active(),
    prepareModel: input => {
      preparations++;
      const bytes = prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, now, 32768);
      standing.active(); return bytes;
    }, replyCheck: { elapsedMs: () => clock, jev: async () => { throw Error('no call'); },
      escalate: async () => { throw Error('no call'); } },
    model: async () => { throw Error('no call'); }, send: async () => { throw Error('no send'); }, checkOutbound: () => {},
  });
  try {
    for (const turn of captured.turns) {
      journal.append({ kind: 'intake', id: turn.id, update: turn.update, raw: turn.raw, text: turn.text,
        accepted: true, cursor: turn.update + 1, at: turn.at });
      if (turn.answer !== undefined) {
        journal.append({ kind: 'reserve', id: turn.id, at: turn.at });
        journal.append({ kind: 'answer', id: turn.id, text: turn.answer, state: 'complete', at: turn.at });
        journal.append({ kind: 'intent', id: turn.id, text: turn.answer, chat: genesis.chat, update: turn.update,
          grant: genesis.grant, at: turn.at });
        journal.append({ kind: 'sent', id: turn.id, message: turn.sent, at: turn.at });
      }
    }
    const probe = () => worker.probe(captured.turns.at(-1).text);
    const result = snapshot ? standing.run(probe) : probe();
    expect('reason' in result).toBe(false);
    expect(preparations).toBeGreaterThan(20);
    if (snapshot) expect(reads).toBe(1); else expect(reads).toBeGreaterThanOrEqual(preparations);
    expect(clock - now).toBe(reads * 354);
    // Revocation after preparation is visible immediately; no snapshot survives to dispatch.
    available = false;
    expect(standing.active()).toBe(false);
    expect(reads).toBeGreaterThan(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('restores fresh standing after a failed preparation and respects a denied grant inside it', () => {
  let reads = 0, allowed = false;
  const standing = toolPreparation(() => { reads++; return allowed; });
  expect(() => standing.run(() => { expect(standing.active()).toBe(false); throw Error('overflow'); })).toThrow('overflow');
  allowed = true;
  expect(standing.active()).toBe(true);
  expect(reads).toBe(2);
});
