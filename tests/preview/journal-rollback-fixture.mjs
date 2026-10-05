#!/usr/bin/env node
// Offline switch fixture for the rollback window. Invoked against an EXPLICIT checkout so the writer and
// the reader really come from different builds. No provider and no Telegram port exists.
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [mode, checkoutArg, rootArg] = process.argv.slice(2);
if (!['write', 'read'].includes(mode) || !checkoutArg || !rootArg)
  throw Error('usage: journal-rollback-fixture.mjs write|read CHECKOUT ROOT');
const checkout = resolve(checkoutArg), root = resolve(rootArg);
const { openPreviewJournal } = await import(pathToFileURL(join(checkout, 'tests/preview/journal.ts')).href);
const key = new Uint8Array(32).fill(47);
const at = 1790520000000;
const id = n => `telegram:12345678:update:${n}`;
const genesis = { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'rollback-switch', configurationDigest: 'sha256:offline', expires: 1790628000000,
  maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const update = (n, text) => ({ update_id: n, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text, date: Math.floor(at / 1000) + n } });
const path = join(root, 'journal.encrypted');

if (mode === 'write') {
  const journal = openPreviewJournal(path, key, genesis);
  try {
    const first = update(1, 'Sam keeps the cedar map in the green drawer.');
    journal.append({ kind: 'intake', id: id(1), update: 1, text: first.message.text, raw: JSON.stringify(first),
      accepted: true, cursor: 2, at: at + 1 });
    journal.append({ kind: 'reserve', id: id(1), prompt: 'switch answer request', at: at + 2 });
    journal.append({ kind: 'answer', id: id(1), text: 'Sam keeps the cedar map in the green drawer.',
      state: 'complete', at: at + 3 });
    journal.append({ kind: 'intent', id: id(1), text: 'PREVIEW — Sam keeps the cedar map in the green drawer.',
      chat: genesis.chat, update: 1, grant: genesis.grant, at: at + 4 });
    journal.append({ kind: 'sent', id: id(1), message: 101, at: at + 5 });
    // The frame cint-L45 added and cint-L44 has no branch for. Written by the real writer, not hand-sealed.
    journal.append({ kind: 'session-work', at: at + 6, record: { type: 'SessionWorkEdge', schemaVersion: 1,
      id: 'edge-1', parent: 'parent-run', child: 'child-run', scope: 'one bounded step', owner: 'preview',
      authority: 'parent grant', exitTest: 'child answered', placement: 'local', transport: 'in-process',
      resultDestination: 'parent', budget: { steps: 1, deadline: at + 60_000, tokens: null, calls: 1,
        maxResultBytes: 4096 }, openedAt: at + 6 } });
    process.stdout.write('wrote\n');
  } finally { journal.close(); }
} else {
  const journal = openPreviewJournal(path, key, undefined, undefined, true);
  try {
    process.stdout.write(`${JSON.stringify({ cursor: journal.view.cursor,
      turns: journal.view.order.map(turn => turn.update), answer: journal.view.order[0]?.answer,
      forward: (journal.view.forwardFrames ?? []).map(frame => frame.kind) })}\n`);
  } finally { journal.close(); }
}
