import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { fitStatusLines } from './status-command.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
// @ts-expect-error The physical host renderer stays plain JavaScript.
import { harnessStatusLine } from './harness-user.mjs';

const captured = JSON.parse(readFileSync(new URL('./fixtures/harness-status-links-2026-10-07.json', import.meta.url), 'utf8')) as {
  statusReplies: { source: string; update: number; reply: string }[];
};

// The link token shapes used by live proof M106d, including /private/ (the existing
// machineLink signal misses that prefix). Do not substitute the narrower signal here.
const links = (text: string) => text.match(/(?:https?|file):\/\/[^\s)>\]]+|(?<![\w.])(?:\/Users\/|\/private\/|\/tmp\/|~\/)[^\s)>\]]+|(?<![\w/])(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?[^\s)>\]]*/gu) ?? [];

it.each(captured.statusReplies)('removes the inaccessible host path from recorded status update $update', ({ reply }) => {
  // Both original replies fail the unchanged proof's requirement. Keep the real bytes
  // as the negative neighbor, then rebuild only the host line through the shipped renderer.
  expect(links(reply)).toEqual(['/private/tmp']);
  const lines = reply.split('\n');
  expect(lines.filter(line => line.startsWith('Harness identity:'))).toHaveLength(1);
  const host = harnessStatusLine({ ready: true, user: '_instarharness' });
  const rebuilt = fitStatusLines(lines.map(line => line.startsWith('Harness identity:') ? host : line));
  expect(links(rebuilt)).toEqual([]);
  expect(rebuilt).toContain('new entries in the system temporary folder are denied to it from creation');
  expect(rebuilt).toContain('operator files every local user may read elsewhere stay readable to it');
});

it('keeps the readiness outcomes visible without introducing a link', () => {
  const unavailable = harnessStatusLine({ ready: false, reason: 'no user x' });
  expect(unavailable).toContain('UNAVAILABLE');
  expect(unavailable).toContain('every Claude Code launch is held');
  expect(links(unavailable)).toEqual([]);
  expect(harnessStatusLine(null)).toBeNull();
});

it('sends the host identity through the real fixed status path without a machine path', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'harness-status-links-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(81), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 6, maxReplies: 6,
    maxTurns: 6, maxBytes: 32768, cursor: 0,
  });
  try {
    const sent: string[] = [];
    const worker = createJournalWorker(journal, {
      now: () => 1000, stopped: () => false, checkOutbound: () => {},
      statusLines: () => [harnessStatusLine({ ready: true, user: '_instarharness' })],
      model: async () => { throw Error('fixed status must not need an answer model'); },
      send: async input => { sent.push(input.expectedText); return sent.length; },
    });
    worker.intake([{ update_id: 1, message: {
      chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'status',
    } }]);
    await worker.drain();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('new entries in the system temporary folder');
    expect(links(sent[0]!)).toEqual([]);
    expect(journal.view.order[0]?.intent).toBe(sent[0]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
