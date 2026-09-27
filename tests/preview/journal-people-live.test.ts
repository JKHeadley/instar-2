import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SOURCE_PINS, deskStatusSource, readDeskStatus, sourcePacket } from './briefing.js';
import { readRuns, selfState, selfStateSource } from './self-state.js';
import { operatorDigest } from './operator-digest.js';

const key = new Uint8Array(32).fill(7);
const operator = 7654321, model = 'claude-opus-5-5';
const sentence = 'The garden plan has tomatoes, beans, squash and herbs along the south fence. ';
/** The desk's filler message, exactly as the live script prescribes it. */
const LIVE_FILLER = `Filler for the memory test, just reply ok. ${sentence.repeat(50).trim()}`;
const script = ['Memory test. My cofounder Sam thinks we should delay the launch to November.',
  'Priya told me she disagrees with Sam — she wants to launch in October.',
  'Separately, my neighbour Sam Ruiz lent me a ladder last weekend.'];
const question = 'What does Sam think about the launch, and did Sam tell you that himself?';

/** Replays the desk's live script through the real sources and the real model envelope, driving it
 * only by the read-only `inspect` command the desk runs, and proves the actual question is
 * answered from a summary with the sourced people notes. The model and Telegram are stubs. */
it('the live script reaches recall: the real question\'s persisted prompt is summary-plus-recent with sourced people', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-people-live-')));
  try {
    const g = { kind: 'genesis' as const, bot: '12345678', chat: String(operator), operator: String(operator),
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 40, maxReplies: 40, maxTurns: 40, maxBytes: 32768, cursor: 0 };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, g);
    writeFileSync(join(root, 'desk-status.md'), '# Instar 2.0 desk report\nLane people-memory: live proof.\n');
    const sources = sourcePacket(path => readFileSync(join(process.cwd(), path), 'utf8'), SOURCE_PINS,
      { providerAttempts: g.maxCalls, expiresAt: g.expires }).sources;
    const worker = createJournalWorker(journal, { now: Date.now, stopped: () => false,
      // The same sources the launcher's turnSources gives every live turn and the inspect probe.
      sources: () => {
        const now = Date.now(), runs = readRuns(join(root, 'runs.jsonl'));
        const desk = deskStatusSource(readDeskStatus(join(root, 'desk-status.md')), now, join(root, 'desk-status.md'));
        return [...sources, selfStateSource(selfState(journal.view, runs, now, 'UTC')), desk,
          operatorDigest(journal.view, runs, desk)];
      },
      prepareModel: input => prepareJournalEnvelope(input, model, g.grant, Date.now()),
      model: async ({ id, context }) => {
        if (!id.startsWith('summary:')) return 'ok';
        // As a real model would: each named person, quoting the operator message that names them.
        const history = (JSON.parse(context) as { history: { user: string }[] }).history;
        const people = history.flatMap(turn => ['Sam Ruiz', 'Priya', 'Sam']
          .filter(name => turn.user.includes(name) && !(name === 'Sam' && turn.user.includes('Sam Ruiz')))
          .map(name => ({ name, quote: turn.user })));
        return JSON.stringify({ summary: 'The operator is running a memory test and mentioned some people.', people });
      },
      send: async () => 1, checkOutbound: () => {} });
    let update = 1;
    const say = async (text: string) => {
      const incoming = { update_id: update, message: { chat: { id: operator, type: 'private' }, from: { id: operator },
        text, date: 1790000000 + update * 60 } };
      worker.intake([incoming]);
      update++;
      await worker.drain(); await worker.summarizeIfNeeded(); // the desk waits until status shows summaryPending 0
    };
    const inspect = (...extra: string[]) => {
      const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
        'tests/preview/journal-agent.mjs', 'inspect', '--root', root, ...extra],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 20000 });
      expect(run.status, run.stderr).toBe(0);
      return JSON.parse(run.stdout);
    };
    expect(Array.from(LIVE_FILLER).length).toBeLessThan(4096);
    for (const text of script) await say(text);
    let fillers = 0, summaryButComplete = false;
    for (;;) {
      const next = inspect('--text', question, '--model', model).next;
      if (next.historyMode === 'summary-plus-recent' && next.people.length) break;
      // The earlier script's stop point: a summary exists, yet the question would still get complete history and no notes.
      if (journal.view.summaries.length && next.historyMode === 'complete') summaryButComplete = true;
      expect(fillers).toBeLessThan(12);
      await say(LIVE_FILLER); fillers++;
    }
    expect(summaryButComplete).toBe(true);
    worker.intake([{ update_id: update, message: { chat: { id: operator, type: 'private' }, from: { id: operator },
      text: question, date: 1790000000 + update * 60 } }]);
    update++;
    await worker.drain();
    const last = inspect().last;
    expect(last.update).toBe(update - 1);
    expect(last.historyMode).toBe('summary-plus-recent');
    expect(last.people.map((entry: { from: string; message: string }) => [entry.from, entry.message])).toEqual(
      script.map(message => ['the operator (verified sender)', message]));
    expect(last.people[2].mentions).toEqual([{ person: 'Sam Ruiz', quote: script[2] }]);
    const view = journal.view;
    process.stdout.write(`live script: ${fillers} fillers; through question 5: turns=${view.order.length}, calls=${view.calls}, replies=${view.replies}, summaries=${view.summaries.length}\n`);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);
