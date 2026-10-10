import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { credentialTextRenderer } from './credential-display.js';
import { createSecretCustody } from './secret-custody.js';
import { createJournalWorker, openPreviewJournal, type OperatorRequestState } from './journal-test-worker.js';
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
    expect(context).not.toContain('preview-activation');
    expect(context).not.toContain('preview-harness-profile-v1-activation');
    expect(context).toContain('your activation');
    expect(packet.history).toHaveLength(live.history.length);
    expect(packet.history[0].answer).toContain('your activation');
    expect(packet.memoryCandidates.some((item: { reply: string }) => item.reply.includes('your activation'))).toBe(true);
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
it.each(['active', 'withdrawn', 'corrected'] as const)('keeps credential-bearing reminders valid only while %s', async disposition => {
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
      return JSON.stringify({ reply: 'Corrected.', dated: [], memory: [{ mode: 'correct',
        source: journal.view.order[0]!.id, quote, replacement }] });
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
      else expect(journal.view.memory).toMatchObject([{ mode: 'correct', quote, replacement }]);
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
