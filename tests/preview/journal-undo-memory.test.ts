import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal, type JournalRecord } from './journal.js';
import { parseDatedItem } from './dated-memory.js';

const key = new Uint8Array(32).fill(37);
const start = 1_790_000_000_000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 };
const update = (id: number, text: string, from = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: from }, text, date: 1_790_000_000 + id } });

type Answer = Extract<JournalRecord, { kind: 'answer' }>;
function seed(journal: ReturnType<typeof openPreviewJournal>, worker: ReturnType<typeof createJournalWorker>,
  id: number, message: string, fields: Partial<Pick<Answer, 'memory' | 'dated'>>
    | ((turnId: string) => Partial<Pick<Answer, 'memory' | 'dated'>>) = {}) {
  worker.intake([update(id, message)]);
  const turn = journal.view.order.at(-1)!;
  journal.append({ kind: 'reserve', id: turn.id, at: start });
  journal.append({ kind: 'answer', id: turn.id, text: 'Recorded.', memory: [], dated: [],
    ...(typeof fields === 'function' ? fields(turn.id) : fields), at: start });
  journal.append({ kind: 'intent', id: turn.id, text: 'PREVIEW — Recorded.', chat: genesis.chat,
    update: turn.update, grant: genesis.grant, at: start });
  journal.append({ kind: 'sent', id: turn.id, message: id, at: start });
  return turn;
}

it.each(['correct', 'forget', 'prefer', 'dated'] as const)('undo reverses the latest %s action durably', async kind => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), `preview-undo-${kind}-`)));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let now = start + 1_000;
    const contexts: Record<string, unknown>[] = [];
    const sends: string[] = [];
    const ports = { now: () => now, stopped: () => false,
      model: async (input: { id: string; context: string }) => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'A memory change was recorded.', people: [], memory: [] });
        contexts.push(packet);
        return JSON.stringify({ reply: 'Undone.', memory: [], dated: [], undo: { change: packet.undoCandidate.change } });
      }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    const original = seed(journal, worker, 1, kind === 'prefer' ? 'I like answers in complete sentences.'
      : kind === 'dated' ? 'My appointment is tomorrow.' : 'The route starts at East Pier.');
    if (kind === 'correct') seed(journal, worker, 2, 'Actually, the route starts at West Pier.', id => ({
      memory: [{ mode: 'correct', source: original.id, quote: 'The route starts at East Pier.',
        replacement: 'the route starts at West Pier.', trigger: id }] }));
    if (kind === 'forget') seed(journal, worker, 2, 'Forget the route starting at East Pier.', id => ({
      memory: [{ mode: 'forget', source: original.id, quote: 'The route starts at East Pier.', trigger: id }] }));
    if (kind === 'prefer') seed(journal, worker, 2, 'I like answers in complete sentences.', id => ({
      memory: [{ mode: 'prefer', source: id, quote: 'I like answers in complete sentences.', trigger: id }] }));
    if (kind === 'dated') seed(journal, worker, 2, 'My appointment is tomorrow.', id => ({
      dated: [parseDatedItem(id, 'My appointment is tomorrow.', 'tomorrow', start, 'UTC')] }));
    const old = journal.view.changeHistory.at(-1)!;
    expect(old.kind).toBe(kind === 'dated' ? 'dated' : 'memory');
    worker.intake([update(3, 'Undo that.')]); await worker.drain();
    expect(journal.view.undos).toMatchObject([{ change: journal.view.changeHistory.length - 1 }]);
    expect(sends).toEqual(['PREVIEW — Undone.']);
    expect(contexts.at(-1)?.undoCandidate).toMatchObject({ kind: old.kind });
    expect(journal.view.order.at(-1)?.sent).toBe(1);
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    expect(journal.view.changeHistory.at(-1)?.undone).toBe(true);
    expect(journal.view.undos).toHaveLength(1);
    if (kind === 'dated') expect(journal.view.dated).toHaveLength(0);
    if (kind === 'prefer') expect(journal.view.memory.filter(item => item.mode === 'prefer')).toHaveLength(0);
    const probe = worker.probe('What do you remember?');
    expect('reason' in probe).toBe(false);
    if ('reason' in probe) throw Error(probe.reason);
    const next = JSON.parse(probe.context);
    if (kind === 'correct' || kind === 'forget') expect(next.history[0].user).toContain('East Pier');
    if (kind === 'correct') expect(probe.context).not.toContain('the route starts at West Pier.');
    if (kind === 'prefer') expect(next.preferences).toBeUndefined();
    if (kind === 'dated') expect(next.dated).toBeUndefined();
    await worker.drain(); expect(sends).toHaveLength(1);
    journal.close();
    if (kind === 'dated') {
      const status = spawnSync(process.execPath,
        ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
          'status', '--root', root],
        { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
          encoding: 'utf8', timeout: 10000 });
      expect(status.status, status.stderr).toBe(0);
      expect(JSON.parse(status.stdout)).toMatchObject({ dated: [], undos: [{ operatorUpdate: 3, kind: 'dated' }] });
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([
  { case: 'expired', elapsed: 600_001, from: 7654321, proposed: 0 },
  { case: 'other sender', elapsed: 1_000, from: 999, proposed: 0 },
  { case: 'wrong target', elapsed: 1_000, from: 7654321, proposed: 99 }
])('does not undo an $case request', async spec => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-undo-refusal-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const ports = { now: () => start + spec.elapsed, stopped: () => false,
      model: async (input: { context: string }) => {
        const packet = JSON.parse(input.context);
        if (spec.case === 'wrong target') expect(packet.undoCandidate.change).toBe(0);
        else expect(packet.undoCandidate).toBeUndefined();
        return JSON.stringify({ reply: 'I undid it.', memory: [], dated: [], undo: { change: spec.proposed } });
      }, send: async () => 1, checkOutbound: () => {} };
    const worker = createJournalWorker(journal, ports);
    seed(journal, worker, 1, 'I like answers in complete sentences.', id => ({ memory: [{ mode: 'prefer', source: id,
      quote: 'I like answers in complete sentences.', trigger: id }] }));
    worker.intake([update(2, 'Undo that.', spec.from)]); await worker.drain();
    expect(journal.view.undos).toHaveLength(0);
    expect(journal.view.memory.some(item => item.mode === 'prefer')).toBe(true);
    if (spec.from === 7654321) expect(journal.view.order.at(-1)?.answer).toContain('could not undo');
    else expect(journal.view.order.at(-1)?.accepted).toBe(false);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a second undo and never reaches back to an older change', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-undo-once-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const ports = { now: () => start + 1_000, stopped: () => false,
      model: async (input: { context: string }) => {
        const packet = JSON.parse(input.context);
        return JSON.stringify({ reply: 'Undone.', memory: [], dated: [], undo: { change: packet.undoCandidate?.change ?? 0 } });
      }, send: async () => 1, checkOutbound: () => {} };
    const worker = createJournalWorker(journal, ports);
    seed(journal, worker, 1, 'I like answers in complete sentences.', id => ({ memory: [{ mode: 'prefer', source: id,
      quote: 'I like answers in complete sentences.', trigger: id }] }));
    seed(journal, worker, 2, 'I enjoy detailed answers.', id => ({ memory: [{ mode: 'prefer', source: id,
      quote: 'I enjoy detailed answers.', trigger: id }] }));
    worker.intake([update(3, 'Undo that.')]); await worker.drain();
    worker.intake([update(4, 'Undo that again.')]); await worker.drain();
    expect(journal.view.undos).toHaveLength(1);
    expect(journal.view.memory.some(item => item.mode === 'prefer' && item.quote === 'I like answers in complete sentences.')).toBe(true);
    expect(journal.view.order.at(-1)?.answer).toContain('could not undo');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('accepts the exact ten-minute boundary', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-undo-boundary-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const ports = { now: () => start + 600_000, stopped: () => false,
      model: async (input: { context: string }) => JSON.stringify({ reply: 'Undone.', memory: [], dated: [],
        undo: { change: JSON.parse(input.context).undoCandidate.change } }),
      send: async () => 1, checkOutbound: () => {} };
    const worker = createJournalWorker(journal, ports);
    seed(journal, worker, 1, 'I like answers in complete sentences.', id => ({ memory: [{ mode: 'prefer', source: id,
      quote: 'I like answers in complete sentences.', trigger: id }] }));
    worker.intake([update(2, 'Undo that.')]); await worker.drain();
    expect(journal.view.undos).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
