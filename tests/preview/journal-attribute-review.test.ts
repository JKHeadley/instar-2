import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

it('keeps a superseded job historical when its successor is forgotten, including replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'astra-attributes-')));
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(29);
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
  let journal = openPreviewJournal(path, key, genesis);
  const ports = { now: () => Date.UTC(2026, 8, 27), stopped: () => false,
    model: async (input: { question: string; context: string }) => {
      const packet = JSON.parse(input.context);
      if (input.question.startsWith('Please remove')) return JSON.stringify({ reply: { answer: 'Forgotten.' }, dated: [],
        personAttributes: [], memory: [{ mode: 'forget',
          source: packet.memoryCandidates.find((item: { id: string }) => item.id.endsWith(':2')).id,
          quote: 'Sam Rivera now works at Beta.' }] });
      return JSON.stringify({ reply: { answer: 'Recorded.' }, memory: [], dated: [], personAttributes: [{
        name: 'Sam Rivera', attribute: 'job', value: input.question.includes('Beta') ? 'Beta' : 'Acme',
        status: 'current', quote: input.question }] });
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    const worker = createJournalWorker(journal, ports);
    for (const [index, text] of ['Sam Rivera now works at Acme.', 'Sam Rivera left Acme. Sam Rivera now works at Beta.',
      'Please remove Sam Rivera now works at Beta from memory.'].entries()) {
      worker.intake([{ update_id: index + 1, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text, date: 1790000000 + index * 86400 } }]);
      await worker.drain();
      if (index === 1) {
        const probe = worker.probe("What is Sam Rivera's current job?");
        if ('reason' in probe) throw Error(probe.reason);
        expect(JSON.parse(probe.context).personAttributes).toEqual(expect.arrayContaining([
          expect.objectContaining({ value: 'Acme', status: 'historical' }),
          expect.objectContaining({ value: 'Beta', status: 'current' })]));
      }
    }
    expect(journal.view.memory).toHaveLength(1);
    expect(journal.view.order[2]?.memoryPending).toBeFalsy();
    const read = (w: ReturnType<typeof createJournalWorker>) => {
      const probe = w.probe("What is Sam Rivera's current job?");
      if ('reason' in probe) throw Error(probe.reason);
      return JSON.parse(probe.context).personAttributes;
    };
    const before = read(worker);
    expect(before).toEqual([expect.objectContaining({ value: 'Acme', status: 'historical' })]);
    journal.close(); journal = openPreviewJournal(path, key, genesis);
    const after = read(createJournalWorker(journal, ports));
    expect(after).toEqual(before);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('exposes attribute evidence through the documented inspect CLI', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'astra-attribute-inspect-')));
  const key = new Uint8Array(32).fill(29);
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const text = 'Sam Rivera now works at Acme.', id = 'telegram:12345678:update:1';
    journal.append({ kind: 'intake', id, update: 1, text, accepted: true, cursor: 2, at: Date.now(),
      raw: JSON.stringify({ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text, date: 1790000000 } }) });
    journal.append({ kind: 'reserve', id, at: Date.now() });
    journal.append({ kind: 'answer', id, text: 'Recorded.', state: 'complete', memory: [], at: Date.now(),
      personAttributes: [{ name: 'Sam Rivera', attribute: 'job', value: 'Acme', status: 'current', source: id, quote: text }] });
    journal.close();
    const child = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'inspect', '--root', root, '--text', "What is Sam Rivera's current job?",
      '--model', 'claude-opus-5-5'], { cwd: process.cwd(), encoding: 'utf8', timeout: 20000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(child.status, child.stderr).toBe(0);
    const output = JSON.parse(child.stdout);
    expect(output.next.held).toBeUndefined();
    expect(output.next).toHaveProperty('personAttributes');
    expect(output.next.personAttributes).toContainEqual(expect.objectContaining({ value: 'Acme', status: 'current' }));
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 25000);
