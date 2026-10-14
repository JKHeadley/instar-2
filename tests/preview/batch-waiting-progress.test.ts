import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, WAITING_PROGRESS, type PreviewPorts } from './journal-test-worker.js';

const roots: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const update = (id: number) => ({ update_id: id, message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: `Question ${id}` } });
function fixture(receipt: number | null = 1) {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const root = mkdtempSync(join(tmpdir(), 'batch-progress-')); roots.push(root);
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(71);
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 30, maxReplies: 30, maxTurns: 20, maxBytes: 262144, cursor: 0 });
  let release!: () => void, entered!: () => void;
  const enteredPromise = new Promise<void>(done => { entered = done; });
  const busy = new Promise<void>(done => { release = done; });
  const sent: { text: string; at: number; target: string | undefined }[] = [];
  const ports: PreviewPorts = { topicConcurrency: 1, now: () => Date.now(), stopped: () => false,
    model: async input => { if (input.id.endsWith(':1')) { entered(); await busy; } return 'Done.'; }, checkOutbound: () => {},
    send: async input => { sent.push({ text: input.expectedText, at: Date.now(), target: input.target }); return input.expectedText === WAITING_PROGRESS ? receipt : sent.length; } };
  const worker = createJournalWorker(journal, ports);
  return { journal, worker, ports, sent, release, enteredPromise, path, key };
}

it.each([1, null])('long queue waits send once per input, at most once per topic per 45 seconds; receipt %s', async receipt => {
  const f = fixture(receipt);
  try {
    f.worker.intake([update(1)]); const drain = f.worker.drain(); await f.enteredPromise;
    f.worker.intake([update(2), update(3), update(4)]);
    await vi.advanceTimersByTimeAsync(44_999);
    expect(f.sent.filter(row => row.text === WAITING_PROGRESS)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.sent.filter(row => row.text === WAITING_PROGRESS)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(90_000);
    const progress = f.sent.filter(row => row.text === WAITING_PROGRESS);
    expect(progress.map(row => row.at)).toEqual([46_000, 91_000, 136_000]);
    expect(new Set(progress.map(row => row.target)).size).toBe(3);
    await vi.advanceTimersByTimeAsync(90_000); expect(f.sent.filter(row => row.text === WAITING_PROGRESS)).toHaveLength(3);
    f.release(); await drain;
    f.journal.compact(); f.journal.close();
    const reopened = openPreviewJournal(f.path, f.key);
    try { await createJournalWorker(reopened, f.ports).drain(); expect(f.sent.filter(row => row.text === WAITING_PROGRESS)).toHaveLength(3); }
    finally { reopened.close(); }
  } finally { f.release(); f.journal.close(); }
});

it('a short wait cancels progress', async () => {
  const f = fixture();
  try {
    f.worker.intake([update(1)]); const drain = f.worker.drain(); await f.enteredPromise;
    f.worker.intake([update(2)]); await vi.advanceTimersByTimeAsync(44_999);
    f.release(); await drain; await vi.advanceTimersByTimeAsync(90_000);
    expect(f.sent.filter(row => row.text === WAITING_PROGRESS)).toHaveLength(0);
  } finally { f.release(); f.journal.close(); }
});


it('stop cancels every waiting progress timer before dispatch', async () => {
  const f = fixture();
  try {
    f.worker.intake([update(1)]); const drain = f.worker.drain().catch(error => error); await f.enteredPromise;
    f.worker.intake([update(2)]); await vi.advanceTimersByTimeAsync(44_999);
    f.worker.stop('operator'); await vi.advanceTimersByTimeAsync(90_000);
    expect(f.sent.filter(row => row.text === WAITING_PROGRESS)).toHaveLength(0);
    f.release(); await drain;
  } finally { f.release(); f.journal.close(); }
});
