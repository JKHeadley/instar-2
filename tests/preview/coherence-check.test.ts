import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { checkReply, COHERENCE_RULES } from './coherence-check.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const key = new Uint8Array(32).fill(7);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 400, maxReplies: 400, maxTurns: 400, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it('flags each checked rule on a violating reply and nothing on its honest neighbour', () => {
  const earlier = ['My cofounder Sam thinks the launch should slip to November.'];
  const cases: [number, string, string][] = [
    [84, "Done. I've scheduled a reminder for Friday.", 'I cannot schedule anything; please set a reminder yourself for Friday.'],
    [84, "I'll remind you tomorrow morning.", 'I cannot message you unprompted, so I will not be able to remind you.'],
    [26, 'You already received my reply about the budget.', 'Telegram accepted my reply; I cannot tell whether you read it.'],
    [89, 'Sam said the launch must slip to November.', 'You said Sam thinks the launch should slip to November.'],
    [96, 'You told me "the budget is capped at nine thousand".', 'You told me "the launch should slip to November".'],
    [106, 'Open http://localhost:4042/dashboard to see it.', 'The dashboard is not reachable from this preview.'],
  ];
  for (const [rule, bad, good] of cases) {
    const flagged = checkReply({ reply: bad, earlier });
    expect(flagged.map(item => item.rule), bad).toEqual([rule]);
    expect(flagged[0]!.excerpt.length).toBeLessThanOrEqual(90);
    expect(checkReply({ reply: good, earlier }), good).toEqual([]);
  }
  // Invented memory with an empty journal, and its honest neighbour.
  expect(checkReply({ reply: 'As you mentioned, the budget is fixed.', earlier: [] }).map(item => item.rule)).toEqual([96]);
  expect(checkReply({ reply: 'I have no earlier message from you about the budget.', earlier: [] })).toEqual([]);
  // Every rule named is in the explicit list, and findings are bounded.
  for (const [rule] of cases) expect(COHERENCE_RULES).toHaveProperty(String(rule));
  expect(checkReply({ reply: cases.map(item => item[1]).join(' '), earlier }).length).toBe(3);
});

it('records every reply after sending, carries a finding once into the next packet, and survives restart', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-coherence-')));
  try {
    const path = join(root, 'journal.encrypted');
    const answers = ["Done. I've scheduled a reminder for Friday.", 'Sorry: I cannot schedule anything, so no reminder exists.', 'Noted.'];
    const contexts: string[] = [], sendsAt: number[] = [];
    let journal = openPreviewJournal(path, key, genesis);
    const make = (j: typeof journal) => createJournalWorker(j, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => { contexts.push(input.context); return prepareJournalEnvelope(input, 'claude-opus-5-5', genesis.grant, 1790000000000); },
      model: async () => answers[contexts.length - 1]!,
      send: async () => { sendsAt.push(performance.now()); return sendsAt.length; }, checkOutbound: () => {} });
    let worker = make(journal);
    worker.intake([update(1, 'Remind me on Friday to call the bank.')]); await worker.drain();
    // The reply was sent before any check ran: nothing coherence-related sits on the reply path.
    expect(journal.view.order[0]!.sent).toBe(1);
    expect(journal.view.order[0]!.checked).toBeUndefined();
    worker.checkCoherence();
    expect(journal.view.order[0]!.checked!.map(item => item.rule)).toEqual([84]);
    expect(journal.view.corrections).toEqual([journal.view.order[0]!.id]);
    worker.checkCoherence(); // idempotent: no second record
    // Restart: the finding and its pending note replay from the journal alone.
    journal.close(); journal = openPreviewJournal(path, key); worker = make(journal);
    expect(journal.view.order[0]!.checked!.map(item => item.rule)).toEqual([84]);
    expect(journal.view.corrections.length).toBe(1);
    worker.intake([update(2, 'So is it set?')]); await worker.drain(); worker.checkCoherence();
    const second = JSON.parse(contexts[1]!);
    expect(second.corrections).toEqual([{ update: 1, date: expect.any(String), findings: [{ rule: 84,
      ruleName: COHERENCE_RULES[84], possibleProblem: 'claimed an action or tool this preview does not have',
      inYourReply: "I've scheduled a reminder for Friday." }] }]);
    expect(second.capability).toContain('corrections lists possible problems');
    const inspected = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'inspect', '--root', root],
    { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
      encoding: 'utf8', timeout: 20000 });
    expect(inspected.status, inspected.stderr).toBe(0);
    expect(JSON.parse(inspected.stdout).last.corrections).toEqual([{
      update: 1, date: expect.any(String), rules: [84],
      problems: ['claimed an action or tool this preview does not have'] }]);
    // Carried once: the corrected reply is clean, and the third packet has no note.
    expect(journal.view.order[1]!.checked).toEqual([]);
    worker.intake([update(3, 'Thanks.')]); await worker.drain(); worker.checkCoherence();
    expect(JSON.parse(contexts[2]!).corrections).toBeUndefined();
    expect(JSON.parse(contexts[0]!).corrections).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a reply reachable when a correction cannot fit and retains the uncarried note across restart', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-coherence-fit-')));
  try {
    const answer = 'Open http://localhost:3000 on this machine.';
    const make = (name: string, maxBytes: number) => {
      const path = join(root, `${name}.encrypted`);
      const journal = openPreviewJournal(path, key, { ...genesis, maxBytes });
      const contexts: string[] = [];
      let sends = 0;
      const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
        prepareModel: input => { contexts.push(input.context); return input.context; },
        model: async () => sends === 0 ? answer : 'The link was machine-only.',
        send: async () => ++sends, checkOutbound: () => {} });
      return { path, journal, worker, contexts, sends: () => sends };
    };
    const sample = make('sample', 32768);
    sample.worker.intake([update(1, 'Where can I open the page?')]); await sample.worker.drain();
    const bare = sample.worker.probe('Can I open it?');
    expect('context' in bare).toBe(true);
    sample.worker.checkCoherence();
    const withNote = sample.worker.probe('Can I open it?');
    expect('context' in withNote).toBe(true);
    const limit = 1552; // Fits the next reply while excluding its optional correction note.
    expect(Buffer.byteLength(('context' in withNote ? withNote.context : ''))).toBeGreaterThan(limit);
    sample.journal.close();

    const trial = make('trial', limit);
    trial.worker.intake([update(1, 'Where can I open the page?')]); await trial.worker.drain();
    trial.worker.checkCoherence();
    trial.worker.intake([update(2, 'Can I open it?')]); await trial.worker.drain();
    expect(trial.sends()).toBe(2);
    expect(trial.journal.view.order[1]!.held).toBeUndefined();
    expect(JSON.parse(trial.contexts[1]!).corrections).toBeUndefined();
    expect(trial.journal.view.corrections).toEqual([trial.journal.view.order[0]!.id]);
    trial.journal.close();
    const replay = openPreviewJournal(trial.path, key);
    expect(replay.view.corrections).toEqual([replay.view.order[0]!.id]);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('carries only the fitted correction batch and preserves later findings', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-coherence-batch-')));
  try {
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, genesis);
    const contexts: string[] = [];
    let calls = 0;
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => { contexts.push(input.context); return input.context; },
      model: async () => ++calls <= 4 ? 'Open http://localhost:3000.' : 'The link is machine-only.',
      send: async () => calls, checkOutbound: () => {} });
    worker.intake([1, 2, 3, 4].map(id => update(id, `Question ${id}`)));
    await worker.drain(); worker.checkCoherence();
    expect(journal.view.corrections).toHaveLength(4);
    worker.intake([update(5, 'Can I use those links?')]); await worker.drain();
    expect(JSON.parse(contexts[4]!).corrections.map((item: { update: number }) => item.update)).toEqual([1, 2, 3]);
    expect(journal.view.corrections).toEqual([journal.view.order[3]!.id]);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.corrections).toEqual([replay.view.order[3]!.id]);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('measures the check: off the reply path, and its own post-reply cost', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-coherence-cost-')));
  try {
    const run = async (name: string, checking: boolean) => {
      const journal = openPreviewJournal(join(root, `${name}.encrypted`), key, { ...genesis, maxBytes: 1_000_000 });
      const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
        model: async () => "Sam said I've scheduled it; you told me \"nothing like this\". See http://localhost:1/x",
        send: async () => 1, checkOutbound: () => {} });
      const replyPath: number[] = [], check: number[] = [];
      for (let i = 1; i <= 120; i++) {
        worker.intake([update(i, `Turn ${i} about Sam and the launch budget ${'x'.repeat(60)}`)]);
        let start = performance.now(); await worker.drain(); replyPath.push(performance.now() - start);
        if (!checking) continue;
        start = performance.now(); worker.checkCoherence(); check.push(performance.now() - start);
      }
      if (checking) expect(journal.view.order.map(turn => turn.checked?.length)).toEqual(Array(120).fill(3));
      journal.close();
      return { replyPath, check };
    };
    const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length * .95)]!;
    const without = await run('without', false), withCheck = await run('with', true);
    // A pure pass plus one fsynced append; generous ceiling for a loaded CI host.
    expect(p95(withCheck.check)).toBeLessThan(50);
    process.stdout.write(`coherence p95 ms over 120 turns: reply path (drain) without check ${p95(without.replyPath).toFixed(2)}, `
      + `with a correction note carried every turn ${p95(withCheck.replyPath).toFixed(2)}; post-reply check ${p95(withCheck.check).toFixed(2)}\n`);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);
