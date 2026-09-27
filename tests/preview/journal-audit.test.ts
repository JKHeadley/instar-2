import { expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditJournal, auditPacket } from './journal-audit.mjs';
import { createJournalWorker, importChannelFixture, openPreviewJournal } from './journal-test-worker.js';
import { memoryHealthLine } from './self-state.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

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
    const wrongCandidateReply = structuredClone(packet);
    const turnCandidate = wrongCandidateReply.memoryCandidates.find((item: { id: string }) => !item.id.startsWith('channel:') && !item.id.startsWith('channel-ref:'));
    expect(turnCandidate).toBeDefined();
    turnCandidate.reply = 'invented earlier reply';
    expect(auditPacket(journal.view, last, wrongCandidateReply).findings.map((item: { code: string }) => item.code))
      .toContain('candidate-reply-source');
    const wrongChannelReply = structuredClone(packet);
    const channelCandidate = wrongChannelReply.memoryCandidates.find((item: { id: string }) => (item.id.startsWith('channel:') || item.id.startsWith('channel-ref:')));
    expect(channelCandidate).toBeDefined();
    channelCandidate.reply = 'invented imported reply';
    expect(auditPacket(journal.view, last, wrongChannelReply).findings.map((item: { code: string }) => item.code))
      .toContain('candidate-reply-source');
    const wrongReplacement = structuredClone(packet);
    wrongReplacement.memory[0].replacement = 'The itinerary word is invented magpie.';
    expect(auditPacket(journal.view, last, wrongReplacement).findings.map((item: { code: string }) => item.code))
      .toContain('memory-replacement-source');
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

it('verifies memorySummary from the prior summary in complete history and after replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-memory-summary-')));
  try {
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'Sam likes tea.', people: [], commitments: [], closed: [] }) : 'Noted.',
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Sam likes tea.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    worker.intake([update(2, 'What does Sam like?')]); await worker.drain();
    const packet = JSON.parse(JSON.parse(journal.view.lastPrompt!.prompt!).messages[1].content).packet;
    expect(packet.historyMode).toBe('complete');
    expect(packet.summary).toBeUndefined();
    expect(packet.memorySummary).toBeDefined();
    expect(auditJournal(journal.view).findings).toEqual([]);
    expect(auditJournal(journal.view).items).toContainEqual(expect.objectContaining({ kind: 'memory-summary',
      chain: [{ kind: 'summary', through: 1 }] }));
    const altered = structuredClone(packet);
    altered.memorySummary.text = 'Sam likes coffee.';
    expect(auditPacket(journal.view, journal.view.order[1]!, altered).findings.map((item: { code: string }) => item.code))
      .toContain('memory-summary-source');
    journal.close(); journal = openPreviewJournal(path, key);
    expect(auditJournal(journal.view).findings).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('checks open commitments at reservation, including a closure by that summary and replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-closure-')));
  try {
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => {
        if (!input.id.startsWith('summary:')) return 'Noted.';
        const packet = JSON.parse(input.context);
        return JSON.stringify({ summary: 'A dentist task.', people: [],
          commitments: packet.history.some((item: { user: string }) => item.user === 'Remind me to call the dentist.')
            ? [{ in: 'message', quote: 'Remind me to call the dentist.' }] : [],
          closed: packet.history.some((item: { user: string }) => item.user === 'I already called the dentist.')
            ? [{ id: 0, quote: 'I already called the dentist.' }] : [] });
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Remind me to call the dentist.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    worker.intake([update(2, 'I already called the dentist.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    const latest = journal.view.lastPrompt!;
    const packet = JSON.parse(JSON.parse(latest.prompt!).messages[1].content).packet;
    expect(packet.openCommitments).toHaveLength(1);
    expect(journal.view.closed.has(0)).toBe(true);
    expect(latest.closedCount).toBe(0);
    expect(auditJournal(journal.view).findings).toEqual([]);
    journal.close(); journal = openPreviewJournal(path, key);
    expect(auditJournal(journal.view).findings).toEqual([]);
    expect(auditPacket(journal.view, { ...journal.view.order[1]!, update: 3 }, packet,
      latest.memoryCount, latest.summaryCount, 1)
      .findings.map((item: { code: string }) => item.code)).toContain('open-commitment-source');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('audits a recorded preference beside an imported source after replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-preference-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, { ...genesis, maxBytes: 16000 });
    importChannelFixture(journal, [{ source: 'email', account: 'agent@example.test', id: 'mail-1',
      from: 'sam@example.test', at: 1789999000000, subject: 'Studio', text: 'The studio opens Friday.' }],
    'agent@example.test', 1790000000000);
    const ports = { now: () => 1790000000000, stopped: () => false,
      prepareModel: (input: { question: string; context: string; id: string }) =>
        prepareJournalEnvelope(input, 'offline-model', genesis.grant, 1790000000000, 16000),
      model: async (input: { id: string; question: string; context: string }) => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The operator prefers brief replies.', people: [],
          memory: [{ mode: 'prefer', source: JSON.parse(input.context).memoryRequest.id,
            quote: 'Please keep your replies brief.' }] })
        : input.question === 'Please keep your replies brief.' ? 'Okay.' : 'The studio opens Friday.',
      send: async () => 1, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Please keep your replies brief.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'prefer' }]);
    expect(memoryHealthLine(journal.view)).toContain('0 old-claim items withheld');
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    worker.intake([update(2, 'When does the studio open?')]); await worker.drain();
    expect(auditJournal(journal.view).findings).toEqual([]);
    const turn = journal.view.order.at(-1)!;
    const packet = JSON.parse(JSON.parse(turn.prompt!).messages[1].content).packet;
    const tampered = structuredClone(packet);
    tampered.preferences[0].text = 'invented preference';
    expect(auditPacket(journal.view, turn, tampered).findings.map((item: { code: string }) => item.code))
      .toContain('preference-source');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
