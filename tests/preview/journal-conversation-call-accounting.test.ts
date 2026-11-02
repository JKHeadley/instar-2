import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal } from './journal.js';
import type { SessionWorkEdge, SessionWorkCall } from '../../src/assembly/production-session-work.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('charges each conversation call before dispatch against the journal cap without a task reservation', () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'conversation-calls-')); roots.push(root);
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(73);
  const open = () => openPreviewJournal(path, key, {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 3, maxReplies: 30,
    maxTurns: 30, maxBytes: 262144, cursor: 0 });
  let journal = open();
  const edge: SessionWorkEdge = { type: 'SessionWorkEdge', schemaVersion: 1, id: 'conversation:allowance',
    parent: 'launch:conversation', child: 'conversation', scope: '/scope', owner: 'host', authority: 'grant',
    budget: { steps: 1, deadline: 9999999999999, maxResultBytes: 65536, calls: 3, tokens: null },
    charge: 'per-call', exitTest: 'bounded reply', placement: 'host', transport: 'tmux',
    resultDestination: '/scope', openedAt: 1000 };
  journal.append({ kind: 'session-work', record: edge, at: 1000 });
  expect(journal.view.calls).toBe(0);
  const charge = (ordinal: number) => {
    const record: SessionWorkCall = { type: 'SessionWorkCall', schemaVersion: 1, edge: edge.id, ordinal, at: 1000 + ordinal };
    journal.append({ kind: 'session-work', record, at: record.at });
  };
  charge(1); charge(2);
  expect(journal.view.calls).toBe(2);
  journal.close(); journal = open();
  expect(journal.view.calls).toBe(2);
  expect(() => charge(2)).toThrow();
  charge(3);
  expect(journal.view.calls).toBe(3);
  expect(() => charge(4)).toThrow();
  journal.close();
});
