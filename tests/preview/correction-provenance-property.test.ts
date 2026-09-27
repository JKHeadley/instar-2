import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditActiveMemory, auditJournal } from './journal-audit.mjs';
import { openPreviewJournal } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(73);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 };
const raw = (id: number, text: string) => JSON.stringify({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
const random = (seed: number) => {
  let state = seed;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
};

it('traces every active item through random correction, merge, summary and compaction histories', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-provenance-')));
  try {
    const seenKinds = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      const path = join(root, `journal-${seed}.encrypted`);
      const next = random(seed), count = 8 + Math.floor(next() * 9);
      let compactions = 0;
      let journal = openPreviewJournal(path, key, { ...genesis, maxTurns: count + 2 },
        stage => { if (stage === 'compact:after-reopen') compactions++; }, false, 2048);
      const imported = { source: 'email' as const, account: 'agent@example.test', id: `mail-${seed}`,
        from: 'sam@example.test', at: 1789999000000, subject: 'Studio key is blue raven.', text: 'See attached.' };
      const importId = `channel:${JSON.stringify([imported.source, imported.account, imported.id])}`;
      journal.append({ kind: 'channel-item', item: imported, at: 1790000000000 });
      const phrases: { id: string; quote: string }[] = [];
      let expectedCorrections = 0, expectedMerges = 0;
      for (let n = 1; n <= count; n++) {
        const id = `turn-${n}`;
        const quote = n === 1 ? 'Please keep replies brief for Sam.'
          : n === 3 ? 'Sam visits on 2026-10-01.'
            : n === 4 ? 'Please remember that Sam has cedar tea.'
              : n === 8 ? 'What does Sam have?' : `Sam likes cedar tea number ${n}.`;
        const replace = `Sam likes mint tea number ${n}.`;
        const correct = n === 5 || n > 2 && ![3, 4, 8].includes(n) && next() < .42;
        const target = n === 2 ? { id: importId, quote: imported.subject }
          : n === 5 ? phrases[0]
          : correct ? phrases[Math.floor(next() * phrases.length)] : undefined;
        const text = target ? `Please correct ${target.quote} The new fact is ${replace}` : quote;
        const at = 1790000000000 + n * 60000;
        const merge = n > 4 && next() < .25 && journal.view.people.length >= 2
          ? { left: journal.view.people.length - 2, right: journal.view.people.length - 1,
            trigger: id, confirmation: 'Sam' } : undefined;
        journal.append({ kind: 'intake', id, update: n, text, raw: raw(n, text), accepted: true, cursor: n + 1, at });
        journal.append({ kind: 'reserve', id, at });
        journal.append({ kind: 'answer', id, text: 'Noted.',
          ...(target ? { memory: [{ mode: 'correct' as const, source: target.id, quote: target.quote,
            replacement: replace, trigger: id,
            ...(n === 5 ? { replies: [target.id], summaryPassages: ['Summary through 4.'] } : {}) }] }
            : n === 1 ? { memory: [{ mode: 'prefer' as const, source: id, quote: text, trigger: id }] } : {}),
          ...(n === 3 && !target ? { dated: [{ source: id, quote: text, when: '2026-10-01',
            zone: 'America/Los_Angeles', day: '2026-10-01' }] } : {}),
          ...(merge ? { personMerges: [merge] } : {}), at });
        if (n === 1) {
          journal.append({ kind: 'intent', id, text: 'PREVIEW — Noted.', chat: genesis.chat,
            update: n, grant: genesis.grant, at });
          journal.append({ kind: 'sent', id, message: n, at });
        }
        if (merge) expectedMerges++;
        if (target) expectedCorrections++;
        if (!target) phrases.push({ id, quote });
        if (n % 4 === 0) {
          journal.append({ kind: 'summary-reserve', through: n, at });
          journal.append({ kind: 'summary', through: n, text: `Summary through ${n}.`,
            people: [{ name: 'Sam', source: id, quote: text }],
            ...(n === 4 ? { commitments: [{ in: 'message' as const, source: id, quote: text }] } : {}),
            ...(n === 8 ? { questions: [{ source: id, quote: text, reason: 'unanswered-reply' as const }] } : {}), at });
        }
      }
      const before = auditActiveMemory(journal.view);
      for (const item of before.items) seenKinds.add(item.kind);
      expect(compactions, `compaction seed ${seed}`).toBeGreaterThan(0);
      expect(before.findings, `seed ${seed}`).toEqual([]);
      const noPacket = structuredClone(journal.view);
      noPacket.lastPrompt = null;
      expect(auditJournal(noPacket).items).toEqual(before.items);
      expect(auditJournal(noPacket).findings).toEqual([]);
      expect(before.items.filter((item: { kind: string }) => item.kind === 'correction')).toHaveLength(expectedCorrections);
      expect(before.items.some((item: { kind: string }) => item.kind === 'channel-import')).toBe(true);
      expect(before.items.filter((item: { kind: string }) => item.kind === 'person-merge')).toHaveLength(expectedMerges);
      journal.close();
      journal = openPreviewJournal(path, key);
      const after = auditActiveMemory(journal.view);
      expect(after.findings, `replay seed ${seed}`).toEqual([]);
      // The encrypted snapshot and append replay retain the same active lineage.
      expect(after.items).toEqual(before.items);
      const missing = structuredClone(journal.view);
      missing.turns.delete(phrases[0]!.id);
      expect(auditActiveMemory(missing).findings.length).toBeGreaterThan(0);
      const forged = structuredClone(journal.view);
      const turn = forged.turns.get('turn-1')!;
      turn.raw = raw(turn.update, 'A different message.');
      expect(auditActiveMemory(forged).findings.map((item: { code: string }) => item.code))
        .toContain('memory-operator-source-absent');
      const missingImport = structuredClone(journal.view);
      missingImport.channelItems.delete(importId.slice(8));
      expect(auditActiveMemory(missingImport).findings.map((item: { code: string }) => item.code))
        .toContain('memory-import-source-absent');
      if (journal.view.memory.length) {
        const broken = structuredClone(journal.view);
        broken.memory[0]!.trigger = 'missing-operator-turn';
        expect(auditActiveMemory(broken).findings.map((item: { code: string }) => item.code))
          .toContain('memory-change-unattributed');
        const reply = structuredClone(journal.view);
        const withReply = reply.memory.find(change => change.replies?.length)!;
        withReply.replies = ['missing-reply'];
        expect(auditActiveMemory(reply).findings.map((item: { code: string }) => item.code))
          .toContain('memory-reply-source-absent');
        const passage = structuredClone(journal.view);
        const withPassage = passage.memory.find(change => change.summaryPassages?.length)!;
        withPassage.summaryPassages = ['invented summary passage'];
        expect(auditActiveMemory(passage).findings.map((item: { code: string }) => item.code))
          .toContain('memory-summary-passage-absent');
      }
      if (journal.view.personMerges.length) {
        const broken = structuredClone(journal.view);
        broken.personMerges[0]!.confirmation = 'never confirmed';
        expect(auditActiveMemory(broken).findings.map((item: { code: string }) => item.code))
          .toContain('person-merge-unattributed');
      }
      if (journal.view.summaries.length) {
        const broken = structuredClone(journal.view);
        broken.summaries.at(-1)!.through = count + 1;
        expect(auditActiveMemory(broken).findings.map((item: { code: string }) => item.code))
          .toContain('summary-unattributed');
      }
      journal.close();
    }
    expect(seenKinds).toEqual(new Set(['channel-import', 'people-note', 'person-merge', 'commitment',
      'preference', 'correction', 'dated', 'open-question', 'summary']));
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
