import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { credentialTextRenderer } from './credential-display.js';
import { createSecretCustody } from './secret-custody.js';
import { createJournalWorker, importChannelItems, openPreviewJournal, type OperatorRequestState } from './journal-test-worker.js';
import live from './fixtures/credential-answer-live-2026-10-09.json' with { type: 'json' };

const activation = { name: 'preview-activation', kind: 'activation', identity: 'preview-harness-profile-justin-gmail-v1-activation',
  custody: 'activation-record' as const, recordedAt: live.at, expiresAt: 1794519600000,
  expirySource: 'activation-record' as const, reminders: [],
  renewal: { standing: 'none' as const, smallestHumanAction: 'approve a renewed activation record' } };
const key = new Uint8Array(32).fill(46);

it('renders the recorded activation answer context in operator wording and preserves records and approval identity', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'credential-answer-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8820318295', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: activation.expiresAt,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 65536, cursor: 0 });
  try {
    const custody = createSecretCustody(root, key, () => live.at);
    custody.register(activation);
    for (const item of live.history) {
      const update = Number(item.id.split(':').at(-1));
      journal.append({ kind: 'intake', id: item.id, update, text: item.user,
        raw: JSON.stringify({ message: { from: { id: 7654321 } } }), accepted: true, cursor: update + 1, at: live.at - 1000 });
      if (item.answer !== null) {
        journal.append({ kind: 'reserve', id: item.id, at: live.at - 1000,
          prompt: JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: {
            history: [], sources: [{ id: 'activation-evidence', text: item.answer,
              provenance: { reference: activation.name } }] } }) }] }) });
        journal.append({ kind: 'answer', id: item.id, text: item.answer, at: live.at - 1000 });
        journal.append({ kind: 'intent', id: item.id, text: item.answer, chat: '7654321', update,
          grant: 'grant:preview', at: live.at - 1000 });
        journal.append({ kind: 'sent', id: item.id, message: update, at: live.at - 1000 });
      }
    }
    // Replay the exact approval projection; this test never creates or consumes an approval.
    journal.view.operatorRequests.push(...structuredClone(live.operatorRequests) as OperatorRequestState[]);
    const before = readFileSync(path), registryBefore = readFileSync(join(root, 'credentials.json'));
    const recordsBefore = JSON.stringify(journal.view.operatorRequests);
    const sources = [{ id: 'self-state', text: live.delivered, provenance: { reference: 'unchanged-source' } }];
    let reads = 0;
    const probe = (format: boolean, question = live.question) => {
      const worker = createJournalWorker(journal, { now: () => live.at, stopped: () => false, sources,
        ...(format ? { credentialWording: () => { reads++; return credentialTextRenderer(custody.records()); } } : {}),
        model: async () => { throw Error('read-only replay must not call'); },
        send: async () => { throw Error('read-only replay must not send'); }, checkOutbound: () => {} });
      const result = worker.probe(question);
      if ('reason' in result) throw Error(result.reason);
      return result.context;
    };
    expect(probe(false)).toContain('preview-harness-profile-v1-activation');
    const context = probe(true), packet = JSON.parse(context);
    expect(JSON.stringify(packet.history)).not.toContain('preview-activation');
    expect(JSON.stringify(packet.history)).not.toContain('preview-harness-profile-v1-activation');
    expect(context).toContain('your activation');
    expect(packet.history).toHaveLength(live.history.length);
    expect(packet.history[0].answer).toContain('your activation');
    // Decision evidence preserves the exact recorded reply, including its public credential labels.
    expect(packet.memoryCandidates.find((item: { id: string }) => item.id === live.history[0]!.id)?.reply)
      .toBe(live.history[0]!.answer);
    expect(packet.operatorRequest).toMatchObject({ id: '87432af9acef18cc', action: 'renew-expiry', trialEnd: '2026-11-12T21:40Z' });
    expect(packet.operatorRequest.state).toContain('approved by the operator and applied');
    expect(packet.operatorRequest.state).toContain('I can also use that account');
    expect(packet.sources[0]).toMatchObject({ id: 'self-state', provenance: { reference: 'unchanged-source' } });
    expect(reads).toBe(1);
    const historical = JSON.parse(probe(true, 'Why did you say that about my activation?')).replyProvenance;
    const prose = `${historical.reply}\n${historical.recorded.sources[0].text}`;
    expect(prose).toContain('your activation');
    expect(prose).not.toContain('preview-activation');
    expect(prose).not.toContain('preview-harness-profile-v1-activation');
    expect(historical.recorded.sources[0].provenance.reference).toBe(activation.name);
    expect(readFileSync(path)).toEqual(before);
    expect(readFileSync(join(root, 'credentials.json'))).toEqual(registryBefore);
    expect(custody.records()[0]).toEqual(activation);
    expect(JSON.stringify(journal.view.operatorRequests)).toBe(recordsBefore);
    expect(journal.view.order[0]!.intent).toBe(live.history[0]!.answer);
    expect(sources[0]!.text).toBe(live.delivered);
    // Exercise the launcher's real inspect composition too, including the registry-error neighbour.
    // Approval state above is a replayed view only; the history and credential records are on disk.
    for (const malformed of [false, true]) {
      if (malformed) writeFileSync(join(root, 'credentials.json'), '{');
      const child = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
        'tests/preview/journal-agent.mjs', 'inspect', '--root', root, '--model', 'offline', '--text', 'Why did you say that about my activation?'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
        env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
      expect(child.status, child.stderr).toBe(0);
      // inspect exposes counts, not historical prose; the full worker packet is asserted above.
      const next = JSON.parse(child.stdout).next;
      expect(next.history).toBe(live.history.length);
      expect(next.replyProvenance.recorded).toBe(true);
    }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('keeps account identities and unrelated text, handles literal names, and never cascades label replacements', () => {
  const render = credentialTextRenderer([activation, { name: 'profile.[1]', kind: 'subscription-login', identity: 'operator@example.invalid' },
    { name: 'api-key', kind: 'api-key', identity: 'internal-api', displayLabel: 'preview-activation' }]);
  expect(render('profile.[1] operator@example.invalid')).toBe('your subscription sign-in (operator@example.invalid) operator@example.invalid');
  expect(render('preview-activation-copy xpreview-activation')).toBe('preview-activation-copy xpreview-activation');
  expect(render('api-key')).toBe('preview-activation');
  expect(render('uncertain')).toBe('uncertain');
  expect(render('undecided')).toBe('undecided');
  expect(render('')).toBe('');
  expect(credentialTextRenderer([{ ...activation, displayLabel: 'your work activation' }])('preview-activation'))
    .toBe('your work activation');
});

// Synthetic regression from the unit review: display wording must not cancel accepted work.
it.each(['active', 'withdrawn', 'corrected', 'invalid-quote'] as const)('keeps credential-bearing reminders valid only while %s', async disposition => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'credential-answer-reminder-')));
  const path = join(root, 'journal.encrypted');
  const start = Date.UTC(2026, 9, 2, 8, 9);
  let now = start;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8820318295', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2026, 9, 10),
    maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 40000, cursor: 0 });
  const quote = 'Remind me today at 1:25 am to renew preview-activation';
  const withdrawal = 'Cancel that activation reminder';
  const replacement = 'Remind me tomorrow at 1:25 am to renew preview-activation';
  const sent: string[] = [];
  let dueCalls = 0;
  const ports = { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
    credentialWording: () => credentialTextRenderer([]),
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('requested-action:')) { dueCalls++; return 'Time to renew your activation.'; }
      if (input.question === quote) return JSON.stringify({ reply: 'Okay.', memory: [],
        dated: [{ quote, when: 'today at 1:25 am', remind: true }] });
      if (disposition === 'withdrawn') {
        const packet = JSON.parse(input.context) as { reminders: { id: string }[] };
        return JSON.stringify({ reply: 'Cancelled.', memory: [], dated: [],
          cancelReminders: packet.reminders.map(item => ({ id: item.id, quote: withdrawal })) });
      }
      const packet = JSON.parse(input.context) as { memoryCandidates: { id: string; message: string }[] };
      const candidate = packet.memoryCandidates.find(item => item.id === journal.view.order[0]!.id)!;
      return JSON.stringify({ reply: 'Corrected.', dated: [], memory: [{ mode: 'correct',
        source: candidate.id, quote: disposition === 'invalid-quote' ? `${candidate.message} invented` : candidate.message, replacement }] });
    },
    checkOutbound: () => {}, send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const update = (id: number, text: string) => ({ update_id: id, message: {
    chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(now / 1000) } });
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, quote)]); await worker.drain();
    expect(journal.view.dated).toMatchObject([{ quote, remind: true }]);
    expect(sent[0]).toContain('I will act on this once at 2026-10-02 01:25');
    const probe = worker.probe('Which reminders are open?');
    if ('reason' in probe) throw Error(probe.reason);
    expect(JSON.parse(probe.context).reminders).toHaveLength(1);
    expect(JSON.parse(probe.context).dated).toMatchObject([{ quote: 'Remind me today at 1:25 am to renew your activation' }]);
    if (disposition !== 'active') {
      worker.intake([update(2, disposition === 'withdrawn' ? withdrawal : `Correction: ${replacement}`)]);
      await worker.drain();
      if (disposition === 'withdrawn') expect(journal.view.reminderCancels).toHaveLength(1);
      else if (disposition === 'corrected') expect(journal.view.memory).toMatchObject([{ mode: 'correct', quote, replacement }]);
      else {
        expect(journal.view.memory).toHaveLength(0);
        expect(sent).toHaveLength(1);
        expect(journal.view.order[1]!.memoryPending).toBe(true);
        return;
      }
    }
    const beforeDue = sent.length;
    now = Date.UTC(2026, 9, 2, 8, 26);
    await worker.sendRequested();
    expect(dueCalls).toBe(disposition === 'active' ? 1 : 0);
    expect(sent).toHaveLength(beforeDue + (disposition === 'active' ? 1 : 0));
    expect(journal.view.order.filter(turn => turn.requestedAction)).toHaveLength(disposition === 'active' ? 1 : 0);
    journal.close(); journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    // Reinstall the formatter before checking a replayed request, as normal answer preparation does.
    worker.probe('Which reminders are open?');
    await worker.sendRequested(); await worker.sendRequested();
    expect(dueCalls).toBe(disposition === 'active' ? 1 : 0);
    expect(sent).toHaveLength(beforeDue + (disposition === 'active' ? 1 : 0));
    expect(journal.view.dated[0]!.quote).toBe(quote);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

// Copy actual offered evidence on both answer and summary decision paths; never fixture quotes.
it.each(['operator', 'reply', 'channel', 'summary-operator', 'summary-channel'] as const)(
  'round-trips exact %s correction evidence with credential wording installed', async kind => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'credential-decision-')));
    const path = join(root, 'journal.encrypted');
    const now = live.at;
    const original = 'The preview-activation renewal day is Friday.';
    const replacement = 'The preview-activation renewal day is Saturday.';
    const channel = kind.endsWith('channel'), summaryDecision = kind.startsWith('summary-');
    const sends: string[] = [], decisions: string[] = [];
    let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8820318295', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: activation.expiresAt,
      maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 40000, cursor: 0 });
    const ports = { now: () => now, stopped: () => false, credentialWording: () => credentialTextRenderer([]),
      model: async (input: { id: string; question: string; context: string }) => {
        const packet = JSON.parse(input.context);
        if (!input.id.startsWith('summary:') && !input.question.startsWith('Correction:'))
          return JSON.stringify({ reply: kind === 'reply' ? original : 'Okay.', memory: [] });
        if (summaryDecision && !input.id.startsWith('summary:')) return 'I am reviewing the correction.';
        const candidate = packet.memoryCandidates.find((item: { sourceKind: string }) =>
          item.sourceKind === (channel ? 'channel-import' : 'operator-stated'));
        const quote = kind === 'reply' ? candidate.reply : candidate.message;
        const request = packet.memoryRequest?.message ?? input.question;
        const passage = (packet.memorySummary ?? packet.summary).text;
        expect(quote).toBe(original);
        expect(passage).toBe(original);
        expect(request).toContain(replacement);
        decisions.push(input.id);
        const memory = [{ mode: 'correct', source: candidate.id, quote,
          replacement: request.slice('Correction: '.length), summaryPassages: [passage],
          ...(kind === 'reply' ? { in: 'reply' } : {}) }];
        return JSON.stringify(input.id.startsWith('summary:')
          ? { summary: replacement, people: [], memory }
          : { reply: 'Corrected.', memory });
      }, checkOutbound: () => {}, send: async (value: { expectedText: string }) => {
        sends.push(value.expectedText); return sends.length;
      } };
    const update = (id: number, text: string) => ({ update_id: id, message: {
      chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(now / 1000) } });
    try {
      if (channel) importChannelItems(journal, [{ source: 'conversation', account: 'agent@example.test', id: 'renewal-day',
        from: 'operator@example.test', at: now - 1000, conversation: 'Renewal', text: original }], 'agent@example.test', now);
      const worker = createJournalWorker(journal, ports);
      worker.intake([update(1, channel || kind === 'reply' ? 'Which day is activation renewal?' : original)]);
      await worker.drain();
      journal.append({ kind: 'summary-reserve', through: 1, at: now });
      journal.append({ kind: 'summary', through: 1, text: original, at: now });
      worker.intake([update(2, `Correction: ${replacement}`)]); await worker.drain();
      if (summaryDecision) { await worker.summarizeIfNeeded(true); await worker.drain(); }
      expect(decisions.some(id => id.startsWith('summary:'))).toBe(summaryDecision);
      expect(journal.view.memory).toMatchObject([{ mode: 'correct', quote: original, replacement,
        summaryPassages: [original], ...(kind === 'reply' ? { in: 'reply' } : {}) }]);
      expect(sends).toHaveLength(2);
      journal.close(); journal = openPreviewJournal(path, key);
      expect(journal.view.memory).toHaveLength(1);
      const probe = createJournalWorker(journal, ports).probe('What do you remember about activation renewal?');
      if ('reason' in probe) throw Error(probe.reason);
      const packet = JSON.parse(probe.context);
      expect((packet.memorySummary ?? packet.summary)?.text ?? '').not.toContain(original);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

it('preserves captured delivered and empty reply evidence in memory candidates', () => {
  const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
    import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
  const rows = shapes.otherShapes.filter(row => row.kind === 'delivered-reply' || row.kind === 'empty-reply-in-recorded-context');
  expect(rows.map(row => row.id)).toEqual(['telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const row of rows) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'credential-recorded-reply-')));
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8994258214',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: activation.expiresAt, maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 40000, cursor: 0 });
    try {
      const update = Number(row.id.split(':').at(-1));
      journal.append({ kind: 'intake', id: row.id, update, text: 'Review the recorded reply.', accepted: true,
        raw: JSON.stringify({ message: { from: { id: 7654321 } } }), cursor: update + 1, at: live.at - 1000 });
      // Replay the captured projection only. Empty context bytes are not proof of an empty Telegram send.
      journal.view.order[0]!.intent = row.raw;
      const worker = createJournalWorker(journal, { now: () => live.at, stopped: () => false,
        credentialWording: () => credentialTextRenderer([]), checkOutbound: () => {},
        model: async () => { throw Error('read-only replay'); }, send: async () => { throw Error('read-only replay'); } });
      const probe = worker.probe('What was the previous reply?');
      if ('reason' in probe) throw Error(probe.reason);
      expect(JSON.parse(probe.context).memoryCandidates.find((item: { id: string }) => item.id === row.id).reply)
        .toBe(row.raw.replace(/^PREVIEW — /u, '').slice(0, 1000));
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
});

// Reviewer reproduction: the summary writer copies the actual history it receives.
// Valid quotes must survive admission and reopen; invented text must still be rejected.
it.each([
  { format: false, invalid: false }, { format: true, invalid: false },
  { format: false, invalid: true }, { format: true, invalid: true },
])('retains exact summary history facts (formatter=$format, invented=$invalid)', async ({ format, invalid }) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'credential-summary-history-')));
  const path = join(root, 'journal.encrypted');
  const original = 'The preview-activation renewal day is Friday.';
  const reply = 'I will review preview-activation on Friday.';
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8820318295', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: activation.expiresAt,
    maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 40000, cursor: 0 });
  const offered: { id: string; user: string; answer: string | null }[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => live.at, stopped: () => false,
      ...(format ? { credentialWording: () => credentialTextRenderer([]) } : {}),
      model: async input => {
        if (!input.id.startsWith('summary:')) return reply;
        const packet = JSON.parse(input.context);
        offered.push(...packet.history);
        return JSON.stringify({ summary: 'The operator shared a renewal detail.', people: [], memory: [],
          commitments: packet.history.map((item: { answer: string }) => ({
            in: 'reply', quote: item.answer + (invalid ? ' invented' : ''), waitsOn: 'date',
          })),
          memoryItems: packet.history.map((item: { id: string; user: string }) => ({
            source: item.id, quote: item.user + (invalid ? ' invented' : ''),
          })) });
      }, checkOutbound: () => {}, send: async () => 1 });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      date: Math.floor(live.at / 1000), text: original } }]);
    await worker.drain(); await worker.summarizeIfNeeded(true);
    expect(offered).toHaveLength(1);
    expect(offered[0]!.user).toBe(original);
    expect(offered[0]!.answer).toBe(reply);
    const retained = invalid ? [] : [{ source: offered[0]!.id, quote: original }];
    expect(journal.view.summaries.at(-1)?.through).toBe(1);
    expect(journal.view.summaries.at(-1)?.memoryItems ?? []).toEqual(retained);
    expect(journal.view.commitments.map(item => ({ in: item.in, quote: item.quote })))
      .toEqual(invalid ? [] : [{ in: 'reply', quote: reply }]);
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.summaries.at(-1)?.through).toBe(1);
    expect(journal.view.summaries.at(-1)?.memoryItems ?? []).toEqual(retained);
    expect(journal.view.commitments.map(item => ({ in: item.in, quote: item.quote })))
      .toEqual(invalid ? [] : [{ in: 'reply', quote: reply }]);
    expect(journal.view.order[0]!.text).toBe(original);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('offers recorded activation replies and empty context replies unchanged in summary history', async () => {
  const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
    import.meta.url), 'utf8')) as { otherShapes: { id: string; kind: string; raw: string }[] };
  const rows = [
    ...live.history.map(row => ({ id: row.id, user: row.user, answer: row.answer })),
    { id: 'telegram:8820318295:update:969390298', user: live.question, answer: live.delivered },
    ...shapes.otherShapes.filter(row => row.kind === 'delivered-reply' || row.kind === 'empty-reply-in-recorded-context')
      .map(row => ({ id: row.id, user: 'Review the recorded reply.', answer: row.raw.replace(/^PREVIEW — /u, '') })),
  ];
  for (const row of rows) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'credential-summary-recorded-')));
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8820318295', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: activation.expiresAt,
      maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 40000, cursor: 0 });
    const offered: { id: string; user: string; answer: string | null }[] = [];
    try {
      const update = Number(row.id.split(':').at(-1));
      journal.append({ kind: 'intake', id: row.id, update, text: row.user, accepted: true,
        raw: JSON.stringify({ message: { from: { id: 7654321 } } }), cursor: update + 1, at: live.at - 1000 });
      // Replay captured context; an empty answer here is not evidence of an empty Telegram delivery.
      journal.view.order[0]!.intent = row.answer ?? undefined;
      // A synthetic terminal marker admits this captured context to the summary pass, not a transport assertion.
      journal.view.order[0]!.sent = 1;
      const worker = createJournalWorker(journal, { now: () => live.at, stopped: () => false,
        credentialWording: () => credentialTextRenderer([]), checkOutbound: () => {},
        model: async input => {
          offered.push(...JSON.parse(input.context).history);
          return JSON.stringify({ summary: 'The recorded conversation is retained.', people: [], memory: [], questions: [] });
        }, send: async () => { throw Error('summary replay must not send'); } });
      // Installs the same formatter as ordinary answer preparation, then exercises the summary packet.
      worker.probe('What was the previous reply?');
      await worker.summarizeIfNeeded(true);
      expect(offered, row.id).toEqual([expect.objectContaining({ id: row.id, user: row.user, answer: row.answer })]);
      expect(journal.view.summaries.at(-1)?.through, row.id).toBe(update);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
});
