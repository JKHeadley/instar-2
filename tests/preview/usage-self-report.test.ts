import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal } from './journal-test-worker.js';
import { selfState, selfStateBrief, selfStateSource } from './self-state.js';
import { usageReconciliation } from './doorway-map.js';

it('carries recorded-shape measured and unknown usage in both packet forms, without calling reserved used', async () => {
  // Reconstruct the supplied 11-12 observation through the real writer; no private live journal access.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'usage-self-report-')));
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(7), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 40000,
    maxReplies: 40000, maxTurns: 40000, maxBytes: 32768, cursor: 0 });
  try {
    for (let update = 1; update <= 2690; update++) {
      if (update % 50 === 0) await new Promise(resolve => setImmediate(resolve));
      const id = `telegram:12345678:update:${update}`;
      journal.append({ kind: 'intake', id, update, text: 'usage observation', raw: '{}', accepted: true, cursor: update + 1, at: 1000 });
      journal.append({ kind: 'reserve', id, maxInputTokens: 100, maxOutputTokens: 10, at: 1000 });
      journal.append({ kind: 'answer', id, text: '', state: update <= 2353 ? 'complete' : 'uncertain',
        ...(update <= 2353 ? { usage: { inputTokens: 5, outputTokens: 2, inputComplete: true as const, charge: null } } : {}), at: 1000 });
    }
    journal.append({ kind: 'tool-turn', phase: 'reserved', id: journal.view.order[0]!.id, attempt: 0, calls: 14792, at: 1000 });
    const status = usageReconciliation(journal.view);
    expect(status).toMatchObject({ reservedCalls: 17482, reportedCalls: 2353 });
    for (const compact of [false, true]) {
      const packet = selfStateSource(selfStateBrief(journal.view, { launches: [], unreadable: 0 }, 1000, 'UTC', undefined, false, compact)).text;
      if (!compact) {
      expect(packet).toContain('2353 calls with complete reported usage');
      expect(packet).toContain('17482 gross reserved');
      expect(packet).toContain('337 calls with unknown usage');
      expect(packet).toContain('answer: measured input/output 11765/4706');
      expect(packet).toContain('summary: measured input/output 0/0');
      expect(packet).toContain('replyCheck: measured input/output 0/0');
      expect(packet).toContain('reserved input/output 33700/3370');
      } else {
        expect(packet).toContain('reported=2353, unknown usage=337');
        expect(packet).toContain('gross reserved=17482');
        expect(packet).toContain('answer 11765/4706, 33700/3370, 2690, 337');
      }
      expect(packet).not.toContain('17482 of 40000 used');
      expect(packet.match(compact ? /Bill unknown/g : /Billed charge unknown/g)).toHaveLength(1);
      expect(selfState(journal.view, { launches: [], unreadable: 0 }, 1000, 'UTC')).toContain('337 calls with unknown usage');
    }
    const id = journal.view.order[0]!.id;
    journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 1, calls: 73, settlementVersion: 1, at: 1000 });
    journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 1, calls: [], consistent: true, workspaceBytes: 0,
      terminal: { state: 'complete', usage: { inputTokens: 5, outputTokens: 2, inputComplete: true, modelCalls: 1, charge: null } },
      retirement: { closed: true, openDelegations: 0, children: 0, cleanup: true }, at: 1000 });
    journal.append({ kind: 'tool-turn', phase: 'settled', id, attempt: 1, calls: 1, at: 1000 });
    expect(selfStateBrief(journal.view, { launches: [], unreadable: 0 }, 1000, 'UTC')).toContain('72 unused call reservations released; 1 proven tool model calls');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 180000);
