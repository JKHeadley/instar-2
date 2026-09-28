import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, importChannelFixture, openPreviewJournal } from './journal-test-worker.js';
import { replyReviewContext } from './reply-check.js';

const key = new Uint8Array(32).fill(41);
const base = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 200, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
const jevPass = { model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } };
const replyPass = { model: 'jev-1.13.0', answers: Object.fromEntries(
  ['raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint', 'quits_on_self', 'claims_blocked', 'parks_on_user', 'defers_work', 'unrecorded_blocker']
    .map(rule => [rule, { type: 'noul', noul: 0.01 }])) };

/** A repeatable random stream makes failures reproducible by seed and step. */
function random(seed: number) {
  let state = seed;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
}

it('keeps superseded clauses out of later packets, hints, summary inputs and model audits across generated histories', async () => {
  for (let seed = 1; seed <= 12; seed++) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), `preview-forget-property-${seed}-`)));
    const path = join(root, 'journal.encrypted');
    const next = random(seed), stale = new Set<string>(), seen = new Set<string>();
    let journal = openPreviewJournal(path, key, base);
    let id = 1;
    const oldSaved = `ORBIT${seed}X`, newSaved = `NOVA${seed}Y`, oldImport = `EMBER${seed}Z`, otherImport = `CEDAR${seed}Q`;
    const savedClause = `My archive code is ${oldSaved}.`;
    const importedClause = seed === 1 ? `I keep the archive key ${oldImport}.` : `The archive key is ${oldImport}.`;
    const affectedAccount = seed === 1 ? `agent-${oldImport}@example.test` : 'agent@example.test';
    const check = (surface: string, value: string) => {
      seen.add(surface);
      for (const token of stale) expect(value, `seed ${seed}, ${surface}, stale ${token}`).not.toContain(token);
    };
    const ports = { now: () => 1790000000000, stopped: () => false,
      model: async (input: { id: string; question: string; context: string }) => {
        check(input.id.startsWith('summary:') ? 'summary input' : 'answer packet', input.context);
        const packet = JSON.parse(input.context);
        const request = input.id.startsWith('summary:') ? packet.memoryRequest?.message : input.question;
        const correcting = typeof request === 'string' && request.includes(newSaved);
        const forgetting = typeof request === 'string' && request.includes(`forget this fact: ${importedClause}`);
        const token = correcting ? oldSaved : forgetting ? oldImport : null;
        const source = token && packet.memoryCandidates?.find((item: { message: string }) => item.message.includes(token));
        const action = source ? [{ mode: correcting ? 'correct' : 'forget', source: source.id,
          quote: correcting ? savedClause : importedClause,
          ...(correcting ? { replacement: `my archive code is ${newSaved}.` } : {}) }] : [];
        if (input.id.startsWith('summary:')) {
          if (action.length) stale.add(token!);
          return JSON.stringify({ summary: 'The operator updated an archive record.', people: [], memory: action });
        }
        if (action.length) stale.add(token!);
        return action.length ? JSON.stringify({ reply: 'Understood.', memory: action }) : 'Understood.';
      },
      summaryCheck: async (evidence: string) => { check('faithfulness audit', evidence); return jevPass; },
      replyCheck: { elapsedMs: () => 1,
        jev: async (state: string, questions?: Record<string, unknown>) => {
          if (questions) {
            check('summary supervisor', state);
            return { value: { model: 'jev-1.13.0', answers: { summary_integrity: { type: 'noul', noul: stale.size ? 0.99 : 0.01 } } }, latencyMs: 1 };
          }
          return { value: replyPass, latencyMs: 1 };
        },
        summaryReview: async (state: string) => { check('summary reviewer', state);
          return { verdict: 'pass' as const, path: 'subscription' as const, latencyMs: 1 }; },
        escalate: async () => { throw Error('unexpected reply escalation'); },
        reserveEscalation: () => { throw Error('unexpected reply escalation'); }, record: () => {} },
      send: async () => 1, checkOutbound: () => {} };
    try {
      let worker = createJournalWorker(journal, ports);
      const say = async (message: string) => { worker.intake([update(id++, message)]); await worker.drain(); };
      const imported = () => { importChannelFixture(journal, [{ source: 'email' as const, account: affectedAccount,
        id: `archive-${oldImport}`, from: `operator-${oldImport}@example.test`, at: 1789999000000,
        subject: `Archive ${oldImport}`, conversation: `Archive ${oldImport}`, text: importedClause }],
      affectedAccount, 1790000000000);
      importChannelFixture(journal, [{ source: 'email' as const, account: 'agent@example.test', id: `other-${seed}`,
        from: 'operator@example.test', at: 1789999000001, subject: 'Other archive',
        text: `The other archive key is ${otherImport}.` }],
      'agent@example.test', 1790000000000); };
      if (next() < 0.5) { imported(); await say(savedClause); }
      else { await say(savedClause); imported(); }
      const before = worker.probe('What is in the archive?');
      expect('reason' in before, `seed ${seed}, before`).toBe(false);
      if (!('reason' in before)) {
        expect(before.context).toContain(oldSaved);
        expect(before.context).toContain(oldImport);
      }
      if (next() < 0.5) await worker.summarizeIfNeeded(true);
      const actions = next() < 0.5
        ? [`Actually, my archive code is ${newSaved}.`, `Please forget this fact: ${importedClause}`]
        : [`Please forget this fact: ${importedClause}`, `Actually, my archive code is ${newSaved}.`];
      for (const action of actions) {
        await say(action);
        expect(journal.view.memory.some(change => action.includes(oldImport)
          ? change.mode === 'forget' && change.quote === importedClause
          : change.mode === 'correct' && change.quote === savedClause),
        `seed ${seed}: ${action}; memory=${JSON.stringify(journal.view.memory)}; failure=${journal.view.lastSummaryFailure?.reason ?? 'none'}`).toBe(true);
        const probe = worker.probe(action.includes(oldImport)
          ? 'The archive key is CANDIDATE.' : 'My archive code is CANDIDATE.');
        expect('reason' in probe, `seed ${seed}`).toBe(false);
        if (!('reason' in probe)) {
          check('probe packet and contradiction hint', probe.context);
        }
        if (next() < 0.5) await worker.summarizeIfNeeded(true);
        if (next() < 0.5) {
          journal.close(); journal = openPreviewJournal(path, key);
          worker = createJournalWorker(journal, ports);
        }
      }
      journal.close();
      journal = openPreviewJournal(path, key);
      worker = createJournalWorker(journal, ports);
      await say('What is in the archive?');
      await worker.summarizeIfNeeded(true);
      const replay = worker.probe('Is the archive code current?');
      expect('reason' in replay, `seed ${seed}, replay`).toBe(false);
      if (!('reason' in replay)) check('restarted packet', replay.context);
      if (!('reason' in replay)) expect(replay.context).toContain(newSaved);
      if (!('reason' in replay)) expect(replay.context).toContain(otherImport);
      expect(stale).toEqual(new Set([oldSaved, oldImport]));
      expect([...seen]).toEqual(expect.arrayContaining(['answer packet', 'summary input', 'faithfulness audit',
        'summary supervisor', 'summary reviewer', 'probe packet and contradiction hint', 'restarted packet']));
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
}, 60000);

it('projects a committed correction before reply escalation, including after recovery', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-forget-reply-review-')));
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, base);
  const reviewed: string[] = [];
  const ports = { now: () => 1790000000000, stopped: () => false,
    prepareModel: (input: { question: string; context: string }) => JSON.stringify({ messages: [
      { role: 'user', content: input.question }, { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The archive record was updated.', people: [], memory: [] });
      if (input.question.includes('NOVA4826')) {
        const source = JSON.parse(input.context).memoryCandidates.find((item: { message: string }) => item.message.includes('ORBIT7319'));
        return JSON.stringify({ reply: 'Understood.', memory: [{ mode: 'correct', source: source.id,
          quote: 'My archive code is ORBIT7319.', replacement: 'My archive code is NOVA4826.' }] });
      }
      return 'Understood.';
    },
    replyCheck: { elapsedMs: () => 1,
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
        Object.keys(replyPass.answers).map(rule => [rule, { type: 'noul', noul: 0.6 }])) }, latencyMs: 1 }),
      escalate: async (text: string, _id: string, prompt?: string) => {
        if (journal.view.memory.some(change => change.mode === 'correct')) reviewed.push(replyReviewContext(prompt!, text));
        return { verdict: 'pass' as const, ruleIds: [], confidence: 1, latencyMs: 1 };
      } },
    send: async () => 1, checkOutbound: () => {} };
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'My archive code is ORBIT7319.')]); await worker.drain();
    journal.close(); journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    worker.intake([update(2, 'Please update my archive record: My archive code is NOVA4826.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'correct' }]);
    expect(reviewed).toHaveLength(1);
    // The candidate itself is the validated correction acknowledgement (old → new, sent only to
    // the operator); every other part of the review context is projected.
    const { candidateReply, ...context } = JSON.parse(reviewed[0]!) as { candidateReply: string };
    expect(candidateReply).toBe('PREVIEW — Changed My archive code is ORBIT7319. → My archive code is NOVA4826.');
    expect(JSON.stringify(context)).not.toContain('ORBIT7319');
    expect(JSON.stringify(context)).toContain('NOVA4826');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('keeps a newly saved preference visible to summary supervision', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-forget-preference-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, base);
  const supervised: string[] = [];
  const quote = 'I like answers in complete sentences.';
  try {
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: quote, people: [], memory: [] })
        : JSON.stringify({ reply: 'Understood.', memory: [{ mode: 'prefer', source: input.id, quote }] }),
      summaryCheck: async () => jevPass,
      replyCheck: { elapsedMs: () => 1, jev: async (state, questions) => {
        if (questions) supervised.push(state);
        return { value: { model: 'jev-1.13.0', answers: questions
          ? { summary_integrity: { type: 'noul', noul: 0.01 } } : replyPass.answers }, latencyMs: 1 };
      }, escalate: async () => ({ verdict: 'pass' as const, ruleIds: [], confidence: 1, latencyMs: 1 }) },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, quote)]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(journal.view.memory).toMatchObject([{ mode: 'prefer', quote }]);
    expect(supervised.length).toBeGreaterThan(0);
    expect(supervised.at(-1)).toContain(quote);
    expect(supervised.at(-1)).not.toContain('[withheld: operator correction or forgetting]');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
