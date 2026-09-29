import { expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditJournal, auditPacket } from './journal-audit.mjs';
import { createJournalWorker, importChannelItems, openPreviewJournal, probeTurn } from './journal-test-worker.js';
import { memoryHealthLine } from './self-state.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const key = new Uint8Array(32).fill(41);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 8000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it('checks every ordinary accepted turn with and without a latest packet', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-turns-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async () => 'Noted.', send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'First ordinary message.')]); await worker.drain();
    worker.intake([update(2, 'Second ordinary message.')]); await worker.drain();
    for (const noPacket of [false, true]) {
      const clean = structuredClone(journal.view);
      if (noPacket) clean.lastPrompt = null;
      expect(auditJournal(clean).findings).toEqual([]);
      expect(auditJournal(clean).items.filter((item: { kind: string }) => item.kind === 'conversation-turn')).toHaveLength(2);
      const forged = structuredClone(clean);
      const first = forged.turns.get(forged.order[0]!.id)!;
      const raw = JSON.parse(first.raw);
      raw.message.text = 'A different message.';
      first.raw = JSON.stringify(raw);
      expect(auditJournal(forged).findings.map((item: { code: string }) => item.code))
        .toContain('memory-operator-source-absent');
    }
    journal.close();
    const replay = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(auditJournal(replay.view).findings).toEqual([]);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a desk canary out of expected packet history while an ordinary omission still fails', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-canary-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async () => 'Noted.', send: async () => 1, checkOutbound: () => {} });
    for (const [id, text] of [[1, 'Sam likes tea.'], [2, 'Canary check a7e328aa: confirm this build.'],
      [3, 'What does Sam like?']] as const) { worker.intake([update(id, text)]); await worker.drain(); }
    const view = journal.view;
    expect(probeTurn(view, view.order[1]!)).toBe(true);
    const packet = JSON.parse(JSON.parse(view.lastPrompt!.prompt).messages
      .find((m: { role: string }) => m.role === 'context').content).packet;
    expect(packet.history.map((item: { id: string }) => item.id)).toEqual([view.order[0]!.id]);
    expect(auditJournal(view).findings).toEqual([]);
    const erased = structuredClone(packet); erased.history = [];
    expect(auditPacket(view, view.order.at(-1)!, erased).findings.map((item: { code: string }) => item.code))
      .toContain('history-coverage');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('attributes merged reply commitments to each recorded reply', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-reply-merge-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const promise = "I'll remember your request.";
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The request was remembered.', people: [],
          commitments: [{ in: 'reply', quote: promise, waitsOn: 'nothing' }], closed: [] }) : promise,
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Remember the first thing.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    worker.intake([update(2, 'Please also remember our conversation.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(journal.view.commitments).toHaveLength(1);
    expect(journal.view.commitments[0]!.sources).toHaveLength(1);
    expect(auditJournal(journal.view).findings).toEqual([]);
    const forged = structuredClone(journal.view);
    forged.commitments[0]!.sources![0]!.quote = forged.order[1]!.text;
    expect(auditJournal(forged).findings.map((item: { code: string }) => item.code))
      .toContain('commitment-merge-unattributed');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('accepts a summary completed after intake only when offered to the correction decision', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-summary-order-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let now = 1790000000000;
    const worker = createJournalWorker(journal, { now: () => now++, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Sam likes cedar tea.', people: [] });
        if (input.question.startsWith('Please correct')) {
          const packet = JSON.parse(input.context);
          const old = packet.memoryCandidates.find((item: { message: string }) => item.message === 'Sam likes cedar tea.');
          return JSON.stringify({ reply: 'Updated.', memory: [{ mode: 'correct', source: old.id,
            quote: 'Sam likes cedar tea.', replacement: 'Sam likes mint tea.', summaryPassages: ['Sam likes cedar tea.'] }] });
        }
        return 'Noted.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Sam likes cedar tea.')]); await worker.drain();
    worker.intake([update(2, 'Please correct Sam likes cedar tea. Sam likes mint tea.')]);
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries[0]!.at).toBeGreaterThan(journal.view.order[1]!.at);
    await worker.drain();
    expect(journal.view.memory[0]!.summaryPassages).toEqual(['Sam likes cedar tea.']);
    expect(auditJournal(journal.view).findings).toEqual([]);
    const unoffered = structuredClone(journal.view);
    const turn = unoffered.turns.get(unoffered.memory[0]!.trigger)!;
    const prompt = JSON.parse(turn.prompt!);
    const context = prompt.messages.find((message: { role: string }) => message.role === 'context');
    const packet = JSON.parse(context.content);
    delete packet.packet.memorySummary;
    delete packet.packet.summary;
    context.content = JSON.stringify(packet);
    turn.prompt = JSON.stringify(prompt);
    expect(auditJournal(unoffered).findings.map((item: { code: string }) => item.code))
      .toContain('memory-summary-passage-absent');
    const late = structuredClone(journal.view);
    const reservation = late.awayEvents.find(event => event.kind === 'reserve' && event.id === late.memory[0]!.trigger)!;
    late.summaries[0]!.at = reservation.at + 1;
    expect(auditJournal(late).findings.map((item: { code: string }) => item.code))
      .toContain('memory-summary-passage-absent');
    journal.close();
    const replay = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(auditJournal(replay.view).findings).toEqual([]);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps correction lineage valid when a later background summary completes', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-later-summary-')));
  try {
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, { ...genesis, maxBytes: 32768 });
    let now = 1790000000000;
    let releaseSummary!: () => void;
    let summaryStarted!: () => void;
    const started = new Promise<void>(resolve => { summaryStarted = resolve; });
    const held = new Promise<void>(resolve => { releaseSummary = resolve; });
    const worker = createJournalWorker(journal, { now: () => now++, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => {
        if (input.id === 'summary:2') { summaryStarted(); await held; }
        if (input.id.startsWith('summary:')) return JSON.stringify({
          summary: input.id === 'summary:1' ? 'Sam likes cedar tea.' : 'Sam discussed tea. The sky is blue.',
          people: [], commitments: [], closed: [] });
        if (input.question.startsWith('Please correct')) {
          const packet = JSON.parse(input.context);
          const old = packet.memoryCandidates.find((item: { message: string }) => item.message === 'Sam likes cedar tea.');
          return JSON.stringify({ reply: 'Updated.', memory: [{ mode: 'correct', source: old.id,
            quote: 'Sam likes cedar tea.', replacement: 'Sam likes mint tea.', summaryPassages: ['Sam likes cedar tea.'] }] });
        }
        return 'Noted.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Sam likes cedar tea.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    worker.intake([update(2, 'The sky is blue.')]); await worker.drain();
    const background = worker.summarizeIfNeeded(true);
    await started;
    worker.intake([update(3, 'Please correct Sam likes cedar tea. Sam likes mint tea.')]);
    await worker.drain();
    expect(journal.view.memory[0]!.summaryPassages).toEqual(['Sam likes cedar tea.']);
    const correction = journal.view.turns.get(journal.view.memory[0]!.trigger)!;
    const offered = JSON.parse(JSON.parse(correction.prompt!).messages[1].content).packet.memorySummary;
    expect(offered.text).toContain('Sam likes cedar tea.');
    expect(offered.through).toBeUndefined();
    expect(auditJournal(journal.view).findings).toEqual([]);
    releaseSummary(); await background;
    const reservation = journal.view.awayEvents.find(event => event.kind === 'reserve'
      && event.id === journal.view.memory[0]!.trigger)!;
    expect(journal.view.summaries[1]!.at).toBeGreaterThan(reservation.at);
    expect(auditJournal(journal.view).findings).toEqual([]);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(auditJournal(replay.view).findings).toEqual([]);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('audits the recorded packet without emitting bodies and refuses lost provenance or leaked claims', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const account = 'agent@example.test';
    importChannelItems(journal, [{ source: 'conversation', account, id: 'Sam sent the itinerary.', from: 'sam@example.test',
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

it.skip('exits nonzero for a recorded packet without a verifiable provenance chain — SKIPPED: Rule 37 load-timing flake; docs/defects/preview-journal-load-timing-flake.md', () => {
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

it('offers the compact summary once as the correction reference and verifies it after replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-memory-summary-')));
  try {
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => { const packet = JSON.parse(input.context);
        if (input.id.endsWith(':update:2') && packet.historyMode === 'complete') throw Error('complete prompt overflow');
        return JSON.stringify({ messages: [{ role: 'user', content: input.question },
          { role: 'context', content: JSON.stringify({ packet }) }] }); },
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'Sam likes tea.', people: [], commitments: [], closed: [] }) : 'Noted.',
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Sam likes tea.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    worker.intake([update(2, 'What does Sam like?')]); await worker.drain();
    const packet = JSON.parse(JSON.parse(journal.view.lastPrompt!.prompt!).messages[1].content).packet;
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.summary?.through).toBe(1);
    expect(packet.memorySummary).toBeUndefined();
    expect(auditJournal(journal.view).findings).toEqual([]);
    expect(auditJournal(journal.view).items).toContainEqual(expect.objectContaining({ kind: 'summary' }));
    const altered = structuredClone(packet);
    altered.summary.text = 'Sam likes coffee.';
    expect(auditPacket(journal.view, journal.view.order[1]!, altered).findings.map((item: { code: string }) => item.code))
      .toContain('summary-text-source');
    // A legacy packet that also carried the duplicate stays auditable.
    const legacy = { ...structuredClone(packet), memorySummary: { sourceKind: 'inferred-by-summary', text: 'Sam likes coffee.' } };
    expect(auditPacket(journal.view, journal.view.order[1]!, legacy).findings.map((item: { code: string }) => item.code))
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
            ? [{ in: 'message', quote: 'Remind me to call the dentist.', waitsOn: 'nothing' }] : [],
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
    const g = { ...genesis, maxBytes: 32768 };
    let journal = openPreviewJournal(path, key, g);
    const rawPackets: object[] = [];
    importChannelItems(journal, [{ source: 'conversation', account: 'agent@example.test', id: 'mail-1',
      from: 'sam@example.test', at: 1789999000000, text: 'The studio opens Friday.' }],
    'agent@example.test', 1790000000000);
    const ports = { now: () => 1790000000000, stopped: () => false,
      prepareModel: (input: { question: string; context: string; id: string }) =>
        prepareJournalEnvelope(input, 'claude-opus-5-5', g.grant, 1790000000000, g.maxBytes),
      model: async (input: { id: string; question: string; context: string }) => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The operator prefers brief replies.', people: [],
          memory: [{ mode: 'prefer', source: JSON.parse(input.context).memoryRequest.id,
            quote: 'Please keep your replies brief.' }] })
        : (rawPackets.push(JSON.parse(input.context)),
          input.question === 'Please keep your replies brief.' ? 'Okay.' : 'The studio opens Friday.'),
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
    expect(auditPacket(journal.view, turn, rawPackets.at(-1)).findings).toEqual([]);
    expect(Object.keys(packet.preferences[0])).toEqual(['source', 'text']);
    const tampered = structuredClone(packet);
    tampered.preferences[0].text = 'invented preference';
    expect(auditPacket(journal.view, turn, tampered).findings.map((item: { code: string }) => item.code))
      .toContain('preference-source');
    const missing = structuredClone(packet);
    missing.preferences = [];
    expect(auditPacket(journal.view, turn, missing).findings.map((item: { code: string }) => item.code))
      .toContain('preference-source');
    journal.close();
    const cli = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'audit', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
    expect(cli.status, cli.stderr).toBe(0);
    expect(JSON.parse(cli.stdout).findings).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// Live shape (2026-09-29, update 969389612): a longer operator turn whose answer was lost set a reply style.
// The active preference is offered back as a memory candidate carrying only its exact clause and no reply;
// that clause is traceable to the source turn, so the audit (and the memory-provenance store check) agree.
it('traces a preference candidate clause to its source turn even when that turn lost its answer', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-audit-preference-clause-')));
  const path = join(root, 'journal.encrypted');
  try {
    const g = { ...genesis, maxBytes: 32768 };
    const clause = 'Please keep your replies brief.';
    const first = `${clause} I am testing whether the preview still answers after a restart this morning.`;
    const rawPackets: { memoryCandidates?: { id: string; message: string; reply: string }[] }[] = [];
    const ports = { now: () => 1790000000000, stopped: () => false,
      prepareModel: (input: { question: string; context: string; id: string }) =>
        prepareJournalEnvelope(input, 'claude-opus-5-5', g.grant, 1790000000000, g.maxBytes),
      model: async (input: { id: string; question: string; context: string }) => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The operator prefers brief replies.', people: [],
          memory: [{ mode: 'prefer', source: JSON.parse(input.context).memoryRequest.id, quote: clause }] })
        : input.question === first ? { state: 'uncertain' as const }
          : (rawPackets.push(JSON.parse(input.context)), 'The preview is answering.'),
      send: async () => 1, checkOutbound: () => {} };
    let journal = openPreviewJournal(path, key, g);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, first)]); await worker.drain();
    expect(journal.view.order[0]).toMatchObject({ modelState: 'uncertain' });
    expect(journal.view.memory).toMatchObject([{ mode: 'prefer', quote: clause }]);
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    worker.intake([update(2, 'Is the preview answering now?')]); await worker.drain();
    const source = journal.view.order[0]!.id;
    const candidate = rawPackets.at(-1)?.memoryCandidates?.find(item => item.id === source && item.message === clause);
    expect(candidate).toMatchObject({ message: clause, reply: '' });
    expect(auditJournal(journal.view).findings).toEqual([]);
    const turn = journal.view.order.at(-1)!;
    expect(auditPacket(journal.view, turn, rawPackets.at(-1)).findings).toEqual([]);
    // The other side: a clause the source turn never held is still untraced.
    const invented = structuredClone(rawPackets.at(-1)!);
    invented.memoryCandidates!.find(item => item.id === source && item.message === clause)!.message = 'Always reply in French.';
    expect(auditPacket(journal.view, turn, invented).findings.map((item: { code: string }) => item.code))
      .toContain('candidate-text-source');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
