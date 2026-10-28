import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openPreviewJournal } from './journal.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
// @ts-expect-error Physical runner remains JavaScript.
import { runToolTurn } from './tool-turn.mjs';

// Real native run, 2026-10-03, telegram:12345678:update:1. Replay the
// invocation boundary and its admission bytes, not the macOS process owner.
const capture = JSON.parse(readFileSync(new URL('./fixtures/native-loop/live-2026-10-03/stop.json', import.meta.url), 'utf8'));

for (const wrapperStopped of [false, true]) it(`preserves the recorded native stop when wrapper stop=${wrapperStopped}`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'native-stop-outcome-')), path = join(root, 'journal');
  const key = new Uint8Array(32).fill(42), id = 'telegram:12345678:update:1';
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 40, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  const result = { state: capture.state, native: capture.native };
  let launches = 0;
  try {
    const outcome = await runToolTurn({ journal, root, id, prepared: capture.prepared, promptLimit: 32768,
      deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations, now: () => 1, redactText: (text: string) => text,
      stopped: () => wrapperStopped, fallback: async () => { throw Error('unexpected fallback'); },
      scratch: (directory: string) => { const volume = join(directory, 'vol'); mkdirSync(volume); return volume; },
      detach: () => true, unmount: () => true,
      invoke: async (turn: { stateDirectory: string }) => {
        launches++;
        writeFileSync(join(turn.stateDirectory, 'admission.jsonl'), capture.admission);
        return result;
      } });
    expect(launches).toBe(1);
    expect(outcome.result).toBe(result);
    expect(outcome.result.toolChecks).toBeUndefined();
    expect(outcome.trace.consistent).toBe(true);
    expect(outcome.trace.calls).toHaveLength(1);
    expect(JSON.parse(outcome.trace.calls[0].result)).toMatchObject({ interrupted: 'stopped' });
    const before = structuredClone(journal.view.toolTurns);
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.toolTurns).toEqual(before);
    expect(journal.view.toolTurns).toMatchObject({ invocations: 1, toolCalls: 1, inconsistent: 0 });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
