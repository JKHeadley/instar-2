import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { credentialDisplayLabel } from './credential-display.js';
import { createSecretCustody } from './secret-custody.js';
import { createJournalWorker, openPreviewJournal, type OperatorRequestState } from './journal-test-worker.js';
import { selfStateBrief, selfStateSource } from './self-state.js';
import live from './fixtures/credential-answer-live-2026-10-09.json' with { type: 'json' };

const key = new Uint8Array(32).fill(46);
const runs = { launches: [], unreadable: 0 };
const genesis = { kind: 'genesis' as const, bot: '8820318295', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 1794519600000,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 65536, cursor: 0 };
const update = (id: number, text: string, at: number) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(at / 1000) } });
const sources = (journal: ReturnType<typeof openPreviewJournal>, at: number) =>
  [selfStateSource(selfStateBrief(journal.view, runs, at, 'UTC'))];

it('gives the activation question labelled self-state while keeping recorded history, records and approval evidence exact', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'credential-self-state-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  try {
    const activation = { name: 'preview-activation', kind: 'activation', identity: 'preview-harness-profile-v1-activation',
      custody: 'activation-record' as const, recordedAt: live.at, expiresAt: genesis.expires,
      expirySource: 'activation-record' as const, reminders: [],
      renewal: { standing: 'none' as const, smallestHumanAction: 'approve a renewed activation record' } };
    const custody = createSecretCustody(root, key, () => live.at);
    custody.register(activation);
    // These are the exact history and delivered reply captured from update 969390298, not rewritten fixtures.
    const history = [...live.history, { id: `telegram:8820318295:update:${live.source.update}`, user: live.question, answer: live.delivered }];
    for (const item of history) {
      const n = Number(item.id.split(':').at(-1));
      journal.append({ kind: 'intake', id: item.id, update: n, text: item.user,
        raw: JSON.stringify({ message: { from: { id: 7654321 } } }), accepted: true, cursor: n + 1, at: live.at - 1000 });
      journal.append({ kind: 'reserve', id: item.id, at: live.at - 1000 });
      journal.append({ kind: 'answer', id: item.id, text: item.answer, at: live.at - 1000 });
      journal.append({ kind: 'intent', id: item.id, text: item.answer, chat: '7654321', update: n,
        grant: genesis.grant, at: live.at - 1000 });
      journal.append({ kind: 'sent', id: item.id, message: n, at: live.at - 1000 });
    }
    // Read-only replay of the recorded approval projection, never creating or consuming approval authority.
    journal.view.operatorRequests.push(...structuredClone(live.operatorRequests) as OperatorRequestState[]);
    const before = readFileSync(path), registry = readFileSync(join(root, 'credentials.json'));
    const approval = JSON.stringify(journal.view.operatorRequests);
    const fail = () => { throw Error('read-only probe must not call or send'); };
    const worker = createJournalWorker(journal, { now: () => live.at, stopped: () => false,
      sources: () => sources(journal, live.at), model: fail, send: fail, checkOutbound: fail });
    const probe = worker.probe(live.question);
    if ('reason' in probe) throw Error(probe.reason);
    const packet = JSON.parse(probe.context);
    expect(packet.sources[0].text).toContain(`Activation: ${credentialDisplayLabel(activation)}; ends 2026-11-12 21:40 UTC.`);
    const self = JSON.stringify({ sources: packet.sources, operatorRequest: packet.operatorRequest });
    for (const name of [activation.name, activation.identity]) expect(self).not.toContain(name);
    expect(packet.history.map((item: { id: string; user: string; answer: string }) =>
      ({ id: item.id, user: item.user, answer: item.answer }))).toEqual(history.map(({ id, user, answer }) => ({ id, user, answer })));
    expect(JSON.stringify(packet.history)).toContain(activation.name);
    expect(JSON.stringify(packet.memoryCandidates)).toContain(activation.identity);
    expect(packet.operatorRequest).toMatchObject({ id: '87432af9acef18cc', action: 'renew-expiry', trialEnd: '2026-11-12T21:40Z' });
    expect(packet.operatorRequest.state).toContain('approved by the operator and applied');
    expect(packet.operatorRequest.state).toContain('I can also use that account');
    expect(JSON.stringify(journal.view.operatorRequests)).toBe(approval);
    expect(readFileSync(path)).toEqual(before);
    expect(readFileSync(join(root, 'credentials.json'))).toEqual(registry);
    expect(custody.records()).toEqual([activation]);
    // A stop still reports the stop, not a claim that the activation is running.
    journal.append({ kind: 'stop', reason: 'operator stopped', at: live.at });
    expect(sources(journal, live.at)[0]!.text).toContain('Permanent stop latched: operator stopped');
    expect(sources(journal, live.at)[0]!.text).not.toContain('Activation:');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
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
    sources: () => sources(journal, now),
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
    expect(JSON.parse(probe.context).dated).toMatchObject([{ quote }]);
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
    // The reopened worker receives the same self-state source and exact evidence.
    worker.probe('Which reminders are open?');
    await worker.sendRequested(); await worker.sendRequested();
    expect(dueCalls).toBe(disposition === 'active' ? 1 : 0);
    expect(sent).toHaveLength(beforeDue + (disposition === 'active' ? 1 : 0));
    expect(journal.view.dated[0]!.quote).toBe(quote);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

// The other two Astra failures: the model copies exactly the text it was offered.
it.each(['correction', 'summary'] as const)('retains copied %s evidence and rejects an invented quote after reopen', async mode => {
  for (const invalid of [false, true]) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'credential-exact-evidence-')));
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, genesis);
    const original = 'The preview-activation renewal day is Friday.';
    const replacement = 'The activation renewal day is Saturday.';
    let copied = '';
    try {
      const worker = createJournalWorker(journal, { now: () => live.at, stopped: () => false,
        sources: () => sources(journal, live.at), model: async input => {
          const packet = JSON.parse(input.context);
          expect(packet.sources[0].text).toContain('Activation: your activation; ends');
          if (input.id.startsWith('summary:')) {
            copied = packet.history[0].user;
            return JSON.stringify({ summary: 'The operator shared a renewal detail, retained in memoryItems.', people: [], memory: [],
              memoryItems: [{ source: packet.history[0].id, quote: copied + (invalid ? ' invented' : '') }] });
          }
          if (input.question === original) return JSON.stringify({ reply: 'Okay.', memory: [] });
          const candidate = packet.memoryCandidates.find((item: { id: string }) => item.id === journal.view.order[0]!.id);
          copied = candidate.message;
          return JSON.stringify({ reply: 'Corrected.', memory: [{ mode: 'correct', source: candidate.id,
            quote: copied + (invalid ? ' invented' : ''), replacement }] });
        }, send: async () => 1, checkOutbound: () => {} });
      worker.intake([update(1, original, live.at)]); await worker.drain();
      if (mode === 'summary') await worker.summarizeIfNeeded(true);
      else { worker.intake([update(2, `Correction: ${replacement}`, live.at)]); await worker.drain(); }
      expect(copied).toBe(original);
      journal.close(); journal = openPreviewJournal(path, key);
      expect(journal.view.order[0]!.text).toBe(original);
      if (mode === 'correction') {
        expect(journal.view.memory).toHaveLength(invalid ? 0 : 1);
        if (!invalid) expect(journal.view.memory[0]).toMatchObject({ quote: original, replacement });
        else expect(journal.view.order[1]!.memoryPending).toBe(true);
      } else {
        expect(journal.view.summaries).toHaveLength(1);
        expect(journal.view.summaries[0]!.through).toBe(1);
        expect(journal.view.summaries[0]!.memoryItems ?? []).toHaveLength(invalid ? 0 : 1);
        if (!invalid) expect(journal.view.summaries[0]!.memoryItems![0]).toMatchObject({ quote: original });
      }
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
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
      expires: genesis.expires, maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 40000, cursor: 0 });
    try {
      const update = Number(row.id.split(':').at(-1));
      journal.append({ kind: 'intake', id: row.id, update, text: 'Review the recorded reply.', accepted: true,
        raw: JSON.stringify({ message: { from: { id: 7654321 } } }), cursor: update + 1, at: live.at - 1000 });
      // Replay the captured projection only. Empty context bytes are not proof of an empty Telegram send.
      journal.view.order[0]!.intent = row.raw;
      const worker = createJournalWorker(journal, { now: () => live.at, stopped: () => false,
        sources: () => sources(journal, live.at), checkOutbound: () => {},
        model: async () => { throw Error('read-only replay'); }, send: async () => { throw Error('read-only replay'); } });
      const probe = worker.probe('What was the previous reply?');
      if ('reason' in probe) throw Error(probe.reason);
      expect(JSON.parse(probe.context).sources[0].text).toContain('Activation: your activation; ends');
      expect(JSON.parse(probe.context).memoryCandidates.find((item: { id: string }) => item.id === row.id).reply)
        .toBe(row.raw.replace(/^PREVIEW — /u, '').slice(0, 1000));
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
});
