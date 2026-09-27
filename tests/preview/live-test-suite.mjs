#!/usr/bin/env node
// Supervised coordinator for the existing private-chat live procedures.
// It reads the journal; only Justin and the already approved runner can send.
import { existsSync, lstatSync, readFileSync, realpathSync, watch, watchFile, unwatchFile } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { openPreviewJournal } from './journal.js';
import { HOLDING_REPLY } from './reply-check.js';

const procedures = [
  { name: 'jev-live-test.md', minimumAnswers: 1 },
  { name: 'marker-dup-live-test.md', minimumAnswers: 2 },
  { name: 'recall-benchmark-live-test.md', minimumAnswers: 12 },
  { name: 'channel-memory-live-test.md', minimumAnswers: 1 },
  { name: 'dated-memory-live-test.md', minimumAnswers: 5 },
  { name: 'away-digest-live-test.md', minimumAnswers: 2 },
];

const storageKey = () => {
  const value = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
  if (!value) throw Error('preview suite: storage SecretRef unavailable');
  const key = Buffer.from(value, /^[a-f0-9]{64}$/iu.test(value) ? 'hex' : 'base64');
  if (key.length !== 32) throw Error('preview suite: storage SecretRef malformed');
  return key;
};

const snapshot = (root, key) => {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, undefined, undefined, true);
  try {
    const holdingReason = turn => {
      const review = turn.replyChecks?.at(-1);
      if (review?.verdict !== 'violation') return 'holding reply sent';
      return `reply check violation: ${review.ruleIds.join(', ') || 'unspecified rule'}${review.reason ? ` — ${review.reason}` : ''}`;
    };
    const turns = journal.view.turns;
    return {
      order: journal.view.order.map(turn => ({ update: turn.update, intake: turn.accepted,
        answered: turn.answer !== undefined && turn.noticeClass === undefined && turn.intent !== HOLDING_REPLY,
        sent: turn.sent !== undefined, held: turn.held ?? (turn.intent === HOLDING_REPLY ? holdingReason(turn) : null) })),
      holdEvents: journal.view.awayEvents.filter(event => event.kind === 'hold'
        || event.kind === 'intent' && turns.get(event.id)?.intent === HOLDING_REPLY)
        .map(event => event.kind === 'hold' ? event.reason : holdingReason(turns.get(event.id))),
      limits: journal.view.limits, calls: journal.view.calls, replies: journal.view.replies,
      stop: existsSync(join(root, 'preview-stop.json')) || journal.view.stop !== null,
      expires: journal.view.genesis.expires,
    };
  } finally { journal.close(); }
};

export const resultSince = (before, after) => {
  const known = new Set(before.order.map(turn => turn.update));
  const fresh = after.order.filter(turn => !known.has(turn.update));
  const held = after.order.find(turn => turn.held !== null);
  const firstHold = after.holdEvents?.slice(before.holdEvents?.length ?? 0)[0] ?? held?.held;
  return { answered: fresh.filter(turn => turn.answered && turn.sent && turn.held === null).length,
    held: firstHold ? 1 : 0, reason: firstHold ?? '',
    unresolved: fresh.filter(turn => turn.intake && !turn.sent && turn.held === null).length };
};

const table = rows => {
  process.stdout.write('\nProcedure                         Result  Answered  Held  Reason\n');
  for (const row of rows) process.stdout.write(
    `${row.name.padEnd(33)} ${row.result.padEnd(7)} ${String(row.answered).padEnd(9)} ${String(row.held).padEnd(5)} ${row.reason}\n`);
};

async function main() {
  if (process.argv.length !== 3 || !process.argv[2].startsWith('/'))
    throw Error('usage: node --loader ./scripts/slice-ts-loader.mjs tests/preview/live-test-suite.mjs /ABSOLUTE/EXISTING_ROOT');
  const root = resolve(process.argv[2]);
  if (!existsSync(root) || realpathSync(root) !== root || lstatSync(root).isSymbolicLink())
    throw Error('preview suite: root must be an existing canonical directory');
  const key = storageKey();
  const initial = snapshot(root, key);
  const existingHold = initial.order.find(turn => turn.held !== null);
  if (existingHold) {
    table([{ name: 'existing journal', result: 'FAIL', answered: 0, held: 1, reason: existingHold.held }]);
    process.exitCode = 1;
    return;
  }
  const rows = [];
  const input = createInterface({ input: process.stdin, output: process.stdout });
  let exitCode = 0;
  try {
    for (const { name, minimumAnswers } of procedures) {
      const before = snapshot(root, key);
      if (before.stop || before.expires <= Date.now()) {
        rows.push({ name, result: 'FAIL', answered: 0, held: 0, reason: before.stop ? 'runner stopped' : 'trial expired' });
        exitCode = 1;
        break;
      }
      if (before.calls + 2 > before.limits.maxCalls || before.replies >= before.limits.maxReplies
        || before.order.length >= before.limits.maxTurns) {
        rows.push({ name, result: 'FAIL', answered: 0, held: 0, reason: 'trial cap or answer/review headroom exhausted' });
        exitCode = 1;
        break;
      }
      process.stdout.write(`\n=== ${name} ===\n${readFileSync(new URL(name, import.meta.url), 'utf8')}\n`);
      process.stdout.write('Follow the procedure as Justin. The coordinator sends nothing.\n');
      let pending = true;
      let holdReason = '';
      const end = reason => { holdReason = reason; pending = false; input.write(`\n${reason}\n`); input.close(); };
      let changeTimer;
      const checkChange = () => {
        if (!pending) return;
        try {
          const after = snapshot(root, key);
          if (after.stop) end('runner stopped');
          else {
            const result = resultSince(before, after);
            if (result.held) end(`HELD: ${result.reason}`);
          }
        } catch { end('journal read failed'); }
      };
      const watcher = watch(join(root, 'journal.encrypted'), () => {
        if (!changeTimer) changeTimer = setTimeout(() => { changeTimer = undefined; checkChange(); }, 1000);
      });
      watcher.on('error', () => { if (pending) end('journal watch failed'); });
      const stopFile = join(root, 'preview-stop.json');
      const checkStopFile = () => { if (pending && existsSync(stopFile)) checkChange(); };
      watchFile(stopFile, { interval: 500 }, checkStopFile);
      const expiryTimer = setTimeout(() => { if (pending) end('trial expired'); },
        Math.min(Math.max(0, before.expires - Date.now()), 2_147_483_647));
      let verdict = '';
      try { verdict = (await input.question('After checking the actual reply and inspect evidence, enter PASS or FAIL with a reason: ')).trim(); }
      catch { /* A detected hold closes the prompt. */ }
      finally { pending = false; watcher.close(); unwatchFile(stopFile, checkStopFile);
        clearTimeout(changeTimer); clearTimeout(expiryTimer); }
      let after;
      try { after = snapshot(root, key); }
      catch { after = before; holdReason ||= 'journal read failed'; }
      const result = resultSince(before, after);
      const reason = holdReason.replace(/^HELD: /u, '') || (after.stop ? 'runner stopped' : '')
        || (after.expires <= Date.now() ? 'trial expired' : '') || result.reason;
      const passed = !reason && result.answered >= minimumAnswers && result.unresolved === 0 && /^PASS$/iu.test(verdict);
      rows.push({ name, result: passed ? 'PASS' : 'FAIL', answered: result.answered,
        held: result.held, reason: reason || (passed ? '' : result.unresolved ? 'reply pending or UNKNOWN'
          : result.answered < minimumAnswers ? `fewer than ${minimumAnswers} confirmed answers`
            : verdict.replace(/^FAIL\s*:?\s*/iu, '') || 'manual PASS missing') });
      if (!passed) { exitCode = 1; break; }
    }
  } finally { input.close(); }
  table(rows);
  process.exitCode = exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
