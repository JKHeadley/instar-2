import { createCipheriv, randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { appendFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { currentActionFacts, outboundSubjectOf } from './journal.js';
import { replyPartTarget } from './reply-parts.js';
import { createJournalWorker, openPreviewJournal, type JournalRecord } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

// Exact retained proof-room rows, including the wrong-minute answer 756. The source
// digest and update ids are retained in the fixture; no live journal/key is opened.
const { rows } = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/ownword-time-1016.json.gz', import.meta.url))).toString()) as { rows: JournalRecord[] };
const id = (update: number) => `telegram:8994258214:update:${update}`;
const packetOf = (prompt: string) => JSON.parse(JSON.parse(prompt).messages.find((m: { role: string }) => m.role === 'context').content).packet;

it('binds the recorded own-word quotes to delivery, despite competing operator times in the exact packet', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ownword-time-'));
  const index = rows.findIndex(row => row.kind === 'reserve' && row.id === id(715676633));
  const recorded = rows[index] as Extract<JournalRecord, { kind: 'reserve' }>;
  const original = packetOf(recorded.prompt!);
  const path = join(root, 'journal'), key = new Uint8Array(32).fill(29);
  let journal = openPreviewJournal(path, key, rows[0] as Extract<JournalRecord, { kind: 'genesis' }>);
  try {
    // These are historical admissions, including agent progress from the old build.
    // Re-sign with the isolated key, then load through replay rather than asking the
    // current new-record admission to accept the old progress policy.
    const retained = rows.slice(1, index).map(row => {
      if (row.kind !== 'intent' && row.kind !== 'held-notice-intent') return row;
      return { ...row, provenance: journal.signOutbound(row.provenance!.speaker, outboundSubjectOf(row)),
        ...(row.kind === 'intent' && row.parts ? { parts: row.parts.map((part, index) => ({ ...part,
          provenance: journal.signOutbound(part.provenance.speaker, { target: replyPartTarget(row.id, index + 2),
            chat: row.chat, ...(row.thread === undefined ? {} : { thread: row.thread }), body: part.body }) })) } : {}) };
    });
    journal.close();
    let offset = readFileSync(path).length;
    for (const row of retained) {
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(Buffer.from(`preview-journal:${offset}`));
      const body = Buffer.concat([cipher.update(JSON.stringify(row)), cipher.final()]);
      const bytes = Buffer.concat([nonce, cipher.getAuthTag(), body]), length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length);
      appendFileSync(path, Buffer.concat([length, bytes])); offset += 4 + bytes.length;
    }
    journal = openPreviewJournal(path, key);
    expect(original.memoryCandidates.find((item: { id: string }) => item.id === id(715676630)).sourceLabel)
      .toContain('/2026-10-16 12:40 PDT/');
    expect(original.actionFacts.siblingWords.items.find((item: { source: string }) => item.source === id(715676630)).at)
      .toBe('2026-10-16 12:41 PDT');
    const failedAnswer = rows.find(row => row.kind === 'answer' && row.id === id(715676633)) as Extract<JournalRecord, { kind: 'answer' }>;
    expect(failedAnswer.text).toContain('source exchange times (when I spoke) were 12:40 PM and 12:42 PM');

    let dispatched: string | undefined;
    const worker = createJournalWorker(journal, {
      now: () => recorded.at, stopped: () => false, timeZone: 'America/Los_Angeles',
      groupDisclosure: async () => true, toolRoute: () => true, sources: () => original.sources ?? [],
      prepareModel: input => prepareJournalEnvelope(input, JSON.parse(recorded.prompt!).model, journal.view.genesis.grant, recorded.at, 409600),
      model: async input => { if (input.id === id(715676633)) dispatched = input.prepared; return { state: 'uncertain' }; },
      checkOutbound: () => {}, send: async () => 999,
    });
    await worker.drain();
    expect(dispatched).toBeDefined();
    const packet = packetOf(dispatched!);
    const words = packet.actionFacts.siblingWords;
    const refreshed = currentActionFacts(journal.view, recorded.at, true, '4').siblingWords!;
    expect(words).toEqual(refreshed);
    expect(words.items).toContainEqual(expect.objectContaining({ kind: 'statement', source: id(715676630), topic: '3',
      ownWords: expect.stringContaining('when I said it: 2026-10-16 12:41 PDT (reply delivery); operator input received: 2026-10-16 12:40 PDT (not when I said it); my words: "Approval request recorded') }));
    for (const kind of ['statement', 'promise']) expect(words.items).toContainEqual(expect.objectContaining({ kind, source: id(715676632),
      ownWords: expect.stringMatching(/^when I said it: 2026-10-16 12:42 PDT \(reply delivery\); operator input received: 2026-10-16 12:41 PDT \(not when I said it\); my words: .*5 pm Pacific today, October 16/u) }));
    expect(words.guidance).toContain('reply delivery');
    expect(words.guidance).toContain('operator');
    expect(words.guidance).toContain('deadline');
    expect(words.items.every((item: { source: string }) => item.source !== id(715676633))).toBe(true);
    expect(Buffer.byteLength(dispatched!)).toBeLessThanOrEqual(409600);
    // Input labels and quoted future deadlines keep their own meaning and values.
    expect(packet.memoryCandidates).toEqual(original.memoryCandidates);
    expect(packet.dated).toEqual(original.dated);
    // A legacy receipt without a delivery clock must not borrow the known input
    // clock. An unaccepted reply is not a delivered own-word statement at all.
    const source = journal.view.turns.get(id(715676630))!;
    delete source.sentAt;
    const ownWords = () => currentActionFacts(journal.view, recorded.at, true, '4').siblingWords!.items;
    expect(ownWords().find(item => item.source === source.id)?.ownWords).toContain('when I said it: date unknown (reply delivery); operator input received:');
    delete source.sent;
    expect(ownWords().some(item => item.source === source.id)).toBe(false);
    expect(currentActionFacts(journal.view, recorded.at, false, '4').siblingWords).toBeUndefined();
    // The recorded General reply has two parts. Its time belongs to the final
    // accepted part; a partial send cannot supply a time for the whole answer.
    const split = journal.view.turns.get(id(715676627))!;
    const last = split.replyParts!.at(-1)!;
    last.sentAt = 1792179666986;
    expect(ownWords().find(item => item.source === split.id)?.ownWords).toContain('when I said it: 2026-10-16 12:41 PDT (reply delivery); operator input received:');
    delete last.sent;
    expect(ownWords().some(item => item.source === split.id)).toBe(false);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
