#!/usr/bin/env node
// Plan row #313 / observer #132. One journal holding an open agent-owned loop, whose genesis names no revisit
// interval because the build that wrote it had no such field. Invoked against an explicit checkout so the
// writer and the reader really come from different builds. No provider or Telegram port exists.
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [checkoutArg, rootArg] = process.argv.slice(2);
if (!checkoutArg || !rootArg) throw Error('usage: loop-cadence-fixture.mjs CHECKOUT ROOT');
const checkout = resolve(checkoutArg), root = resolve(rootArg);
const base = await import(pathToFileURL(join(checkout, 'tests/preview/journal.ts')).href);
// The point of the fixture is a genesis written with no interval field at all. A checkout that already knows
// the field would write the same bytes by accident, and the test would prove nothing.
if (base.loopRevisitMs !== undefined || base.LOOP_REVISIT_MIN_MS !== undefined)
  throw Error('fixture writer already knows the per-root revisit interval');
if (base.LOOP_REVISIT_MS !== 24 * 3_600_000) throw Error('fixture writer has a different default interval');

const key = new Uint8Array(32).fill(53);
const at = 1790520000000;
const id = n => `telegram:12345678:update:${n}`;
const LATER = 'I will look into the invoice question later today.';
const genesis = { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'loop-cadence-fixture', configurationDigest: 'sha256:offline', expires: 1790628000000,
  maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const update = { update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
  text: 'Can you check the invoice question?', date: Math.floor(at / 1000) } };
const loops = [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }];

const journal = base.openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
try {
  if (journal.view.genesis.loopRevisitMs !== undefined) throw Error('fixture genesis carries an interval');
  journal.append({ kind: 'intake', id: id(1), update: 1, text: update.message.text, raw: JSON.stringify(update),
    accepted: true, cursor: 2, at: at + 1 });
  journal.append({ kind: 'reserve', id: id(1), prompt: 'fixture answer request', at: at + 2 });
  journal.append({ kind: 'answer', id: id(1), text: LATER, state: 'complete', loops, at: at + 3 });
  journal.append({ kind: 'intent', id: id(1), text: `PREVIEW — ${LATER}`, chat: genesis.chat, update: 1,
    grant: genesis.grant, loops, at: at + 4 });
  journal.append({ kind: 'sent', id: id(1), message: 101, at: at + 5 });
  if (journal.view.commitments.length !== 1) throw Error('fixture recorded no open loop');
} finally { journal.close(); }
process.stdout.write('fixture written\n');
