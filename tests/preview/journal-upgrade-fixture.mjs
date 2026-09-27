#!/usr/bin/env node
// Offline switch fixture. Invoke against an explicit checkout so the writer and
// reader really come from different builds. No provider or Telegram port exists.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [mode, checkoutArg, rootArg] = process.argv.slice(2);
if (!['write', 'exercise'].includes(mode) || !checkoutArg || !rootArg) throw Error('usage: journal-upgrade-fixture.mjs write|exercise CHECKOUT ROOT');
const checkout = resolve(checkoutArg), root = resolve(rootArg);
const { openPreviewJournal, createJournalWorker, renewJournalExpiry } = await import(pathToFileURL(join(checkout, 'tests/preview/journal.ts')).href);
const { SUBSCRIPTION_PREVIEW_EXPIRY } = await import(pathToFileURL(join(checkout, 'src/assembly/production-provider.ts')).href);
const key = new Uint8Array(32).fill(47);
const at = 1790520000000;
const id = n => `telegram:12345678:update:${n}`;
const genesis = { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'upgrade-fixture', configurationDigest: 'sha256:offline', expires: 1790628000000,
  maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const update = (n, text) => ({ update_id: n, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text, date: Math.floor(at / 1000) + n } });
const path = join(root, 'journal.encrypted');

if (mode === 'write') {
  if (SUBSCRIPTION_PREVIEW_EXPIRY !== 1791232800000) throw Error('fixture writer is not the renewed build');
  const journal = openPreviewJournal(path, key, genesis);
  try {
    const first = update(1, 'Sam keeps the cedar map in the blue drawer.');
    journal.append({ kind: 'intake', id: id(1), update: 1, text: first.message.text, raw: JSON.stringify(first),
      accepted: true, cursor: 2, at: at + 1 });
    journal.append({ kind: 'reserve', id: id(1), prompt: 'fixture answer request', at: at + 2 });
    journal.append({ kind: 'answer', id: id(1), text: 'I recorded the blue drawer.', state: 'complete', at: at + 3 });
    journal.append({ kind: 'intent', id: id(1), text: 'PREVIEW — I recorded the blue drawer.',
      chat: genesis.chat, update: 1, grant: genesis.grant, at: at + 4 });
    journal.append({ kind: 'sent', id: id(1), message: 101, at: at + 5 });
    const second = update(2, 'Actually, Sam keeps the cedar map in the green drawer.');
    journal.append({ kind: 'intake', id: id(2), update: 2, text: second.message.text, raw: JSON.stringify(second),
      accepted: true, cursor: 3, at: at + 6 });
    journal.append({ kind: 'reserve', id: id(2), prompt: 'fixture correction request', at: at + 7 });
    journal.append({ kind: 'answer', id: id(2), text: 'I recorded the correction.', state: 'complete', at: at + 8 });
    journal.append({ kind: 'intent', id: id(2), text: 'PREVIEW — I recorded the correction.',
      chat: genesis.chat, update: 2, grant: genesis.grant, at: at + 9 });
    journal.append({ kind: 'sent', id: id(2), message: 102, at: at + 10 });
    journal.append({ kind: 'summary-reserve', through: 2, prompt: 'fixture summary request', at: at + 11 });
    journal.append({ kind: 'summary', through: 2, text: 'Sam keeps the cedar map in the green drawer.',
      memory: [{ mode: 'correct', source: id(1), quote: 'Sam keeps the cedar map in the blue drawer.',
        trigger: id(2), replacement: 'Sam keeps the cedar map in the green drawer.' }], at: at + 12 });
    const third = update(3, 'Please hold this separate question.');
    journal.append({ kind: 'intake', id: id(3), update: 3, text: third.message.text, raw: JSON.stringify(third),
      accepted: true, cursor: 4, at: at + 13 });
    journal.append({ kind: 'hold', id: id(3), reason: 'reply check unavailable', at: at + 14 });
    renewJournalExpiry(journal, { expires: SUBSCRIPTION_PREVIEW_EXPIRY, activation: `sha256:${'a'.repeat(64)}`,
      authority: 'offline renewal fixture', at: at + 15 });
  } finally { journal.close(); }
  // The live runner's content-free model-json-shapes sidecar schema. It is
  // independent diagnostics, so the journal remains the sole causal store.
  writeFileSync(join(root, 'model-json-shapes.json'), JSON.stringify({ version: 1,
    counts: { 'answer/decision/tolerated/fenced': 1 }, last: null }));
  process.stdout.write('fixture written\n');
} else {
  const journal = openPreviewJournal(path, key);
  try {
    const shapes = JSON.parse(readFileSync(join(root, 'model-json-shapes.json'), 'utf8'));
    const before = { cursor: journal.view.cursor, calls: journal.view.calls, replies: journal.view.replies,
      expires: journal.view.expires, expiryAuthority: journal.view.expiryAuthority,
      held: journal.view.order.filter(turn => turn.held).map(turn => [turn.update, turn.held]),
      summary: journal.view.summaries.map(row => [row.through, row.text]),
      memory: journal.view.memory, shapes };
    const sent = [];
    const worker = createJournalWorker(journal, { now: () => at + 1000, stopped: () => false,
      model: async ({ context }) => {
        const packet = JSON.parse(context);
        const match = packet.summary?.text?.includes('green drawer')
          || packet.memory?.some(item => item.replacement?.includes('green drawer'));
        if (!match) throw Error('corrected answer evidence missing');
        return 'Sam keeps the cedar map in the green drawer.';
      }, checkOutbound: () => {}, send: async item => { sent.push(item.expectedText); return 103; } });
    const probe = worker.probe('Where does Sam keep the cedar map?');
    if ('reason' in probe) throw Error(`probe refused: ${probe.reason}`);
    worker.intake([update(4, 'Where does Sam keep the cedar map?')]);
    await worker.drain();
    const result = { before, probe: JSON.parse(probe.context), sent,
      answer: journal.view.order.at(-1)?.answer, cursor: journal.view.cursor,
      held: journal.view.order.filter(turn => turn.held).map(turn => [turn.update, turn.held]) };
    if (result.answer !== 'Sam keeps the cedar map in the green drawer.' || sent.length !== 1)
      throw Error(`fixture answer did not complete once: ${JSON.stringify({ answer: result.answer,
        memorySearch: result.probe.memorySearch,
        sent, turns: journal.view.order.map(turn => ({ update: turn.update, held: turn.held,
          reserved: turn.reserved, intent: turn.intent })) })}`);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally { journal.close(); }
}
