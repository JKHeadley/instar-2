import { expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditJournal, auditPacket } from './journal-audit.mjs';
import { createJournalWorker, importChannelFixture, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(41);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 8000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it('audits the recorded packet without emitting bodies and refuses lost provenance or leaked claims', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const account = 'agent@example.test';
    importChannelFixture(journal, [{ source: 'email', account, id: 'Sam sent the itinerary.', from: 'sam@example.test',
      at: 1789999000000, text: 'Sam sent the itinerary.' }], account, 1790000000000);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => {
        if (input.question.startsWith('The itinerary word is green')) {
          const packet = JSON.parse(input.context);
          const old = packet.memoryCandidates.find((item: { message: string }) => item.message.includes('blue raven'));
          return JSON.stringify({ reply: 'Updated.', memory: [{ mode: 'correct', source: old.id,
            quote: 'The itinerary word is blue raven.', replacement: 'The itinerary word is green heron.' }] });
        }
        return 'Noted.';
      }, send: async () => 1, checkOutbound: () => {} });
    for (const [id, message] of [
      'The itinerary word is blue raven.',
      'The itinerary word is green heron.',
      'What is the itinerary word Sam sent?'
    ].entries()) { worker.intake([update(id + 1, message)]); await worker.drain(); }
    expect(journal.view.memory).toHaveLength(1);
    const report = auditJournal(journal.view);
    expect(report.findings).toEqual([]);
    expect(report.items.map((item: { kind: string }) => item.kind)).toContain('channel-import');
    expect(report.items.map((item: { kind: string }) => item.kind)).toContain('corrected');
    expect(JSON.stringify(report)).not.toContain('green heron');
    expect(JSON.stringify(report)).not.toContain('blue raven');
    expect(JSON.stringify(report)).not.toContain('Sam sent the itinerary.');
    const last = journal.view.order.at(-1)!;
    const packet = JSON.parse(JSON.parse(last.prompt!).messages[1].content).packet;
    const lost = structuredClone(packet);
    delete lost.history[0].id;
    expect(auditPacket(journal.view, last, lost).findings.map((item: { code: string }) => item.code)).toContain('source-turn-absent');
    const leaked = structuredClone(packet);
    leaked.history[0].user = 'The itinerary word is blue raven.';
    expect(auditPacket(journal.view, last, leaked).findings.map((item: { code: string }) => item.code)).toContain('superseded-current');
    const wrongReply = structuredClone(packet);
    wrongReply.history[1].answer = 'invented reply';
    expect(auditPacket(journal.view, last, wrongReply).findings.map((item: { code: string }) => item.code)).toContain('reply-text-source');
    const wrongImport = structuredClone(packet);
    wrongImport.channelMemory[0].from = 'invented sender';
    expect(auditPacket(journal.view, last, wrongImport).findings.map((item: { code: string }) => item.code)).toContain('channel-attribution');
    journal.close();
    const before = statSync(join(root, 'journal.encrypted')).size;
    const cli = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'audit', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
    expect(cli.status, cli.stderr).toBe(0);
    expect(JSON.parse(cli.stdout).findings).toEqual([]);
    expect(cli.stdout).not.toContain('blue raven');
    expect(cli.stdout).not.toContain('green heron');
    expect(cli.stdout).not.toContain('Sam sent the itinerary.');
    expect(statSync(join(root, 'journal.encrypted')).size).toBe(before);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('requires an attributed person note and catches a reachable forgotten clause', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-notes-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    journal.append({ kind: 'intake', id: 'turn-1', update: 1, text: 'Sam likes cedar tea.', raw: JSON.stringify(update(1, 'Sam likes cedar tea.')),
      accepted: true, cursor: 2, at: 1790000000000 });
    journal.append({ kind: 'intake', id: 'turn-2', update: 2, text: 'Please forget that.', raw: JSON.stringify(update(2, 'Please forget that.')),
      accepted: true, cursor: 3, at: 1790000000000 });
    journal.view.people.push({ name: 'Sam', source: 'turn-1', quote: 'Sam likes cedar tea.' });
    journal.view.memory.push({ mode: 'forget', source: 'turn-1', trigger: 'turn-2', quote: 'Sam likes cedar tea.' });
    const turn = { ...journal.view.order[1]!, update: 3 };
    const packet = { historyMode: 'complete', history: [{ id: 'turn-1', user: 'Sam likes cedar tea.' }, { id: 'turn-2' }],
      people: [{ source: 'turn-1', from: 'Sam (invented)', mentions: [{ person: 'Sam', quote: 'Sam likes cedar tea.' }] }],
      memory: [{ mode: 'forgotten', source: 'turn-1', trigger: 'turn-2' }] };
    const codes = auditPacket(journal.view, turn, packet).findings.map((item: { code: string }) => item.code);
    expect(codes).toContain('people-attribution');
    expect(codes).toContain('forgotten-reachable');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('exits nonzero for a recorded packet without a verifiable provenance chain', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-refusal-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    journal.append({ kind: 'intake', id: 'turn-1', update: 1, text: 'Private body marker.',
      raw: JSON.stringify(update(1, 'Private body marker.')), accepted: true, cursor: 2, at: 1790000000000 });
    journal.append({ kind: 'reserve', id: 'turn-1', prompt: 'unreadable-prompt', at: 1790000000000 });
    journal.close();
    const cli = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'audit', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
    expect(cli.status).toBe(1);
    expect(JSON.parse(cli.stdout).findings).toEqual([{ code: 'recorded-prompt-unreadable', at: 'prompt' }]);
    expect(`${cli.stdout}${cli.stderr}`).not.toContain('Private body marker');
    appendFileSync(join(root, 'journal.encrypted'), Buffer.from([0, 0]));
    const torn = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'audit', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
    expect(torn.status).toBe(1);
    expect(`${torn.stdout}${torn.stderr}`).not.toContain('Private body marker');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('audits a rolling summary when it is the latest model call', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-summary-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'Sam likes tea.', people: [], commitments: [], closed: [] }) : 'Noted.',
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Sam likes tea.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries).toHaveLength(1);
    const report = auditJournal(journal.view);
    expect(report.modelCall).toBe('summary');
    expect(report.findings).toEqual([]);
    expect(report.items.some((item: { kind: string }) => item.kind === 'history-turn')).toBe(true);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
