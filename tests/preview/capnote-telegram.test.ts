import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPABILITY_BRIEFING_PATH, CAPABILITY_LAUNCHER, capabilityBriefing, SOURCE_PINS, sourcePacket } from './briefing.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/capnote-telegram-2026-10-12.json', import.meta.url), 'utf8')) as {
  update: number; question: string; limits: { providerAttempts: number; expiresAt: number; tools: boolean; mcp: number };
  recordedCapabilityNote: { text: string }; telegramAnswers: { quotes: string[] };
};
const read = (path: string) => readFileSync(path, 'utf8');
const clarification = 'the separate Telegram connection (this bot chat works)';

it('replays the three reported Telegram answers with a note that distinguishes their active channel from the dark core adapter', async () => {
  // Historical note from capsentence2 update 840342414; the three later answer excerpts
  // are quoted verbatim in the assigned brief, which does not supply their update ids.
  expect(capture.recordedCapabilityNote.text).toContain('so not available: rungraph-core, slack-conversation-adapter, slack-ordinary-reply, telegram-conversation-adapter.');
  expect(capture.telegramAnswers.quotes).toHaveLength(3);
  const sources = sourcePacket(read, SOURCE_PINS, capture.limits).sources;
  const note = sources.find(source => source.id === 'capability-note')!.text;
  expect(note).toContain(clarification);
  expect(note).toContain('Not enabled here: the separate background-work coordinator, Slack conversations, Slack replies, ' + clarification);
  // No capability has been promoted to available, and sends still require the doorway.
  expect(note).not.toContain('- telegram-conversation-adapter:');
  expect(note).toContain("Before changing a website or sending a message elsewhere, I check");
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'capnote-telegram-')));
  const now = 1790000060000;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(23), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 60000, cursor: 0,
  });
  const sent: string[] = [];
  let calls = 0;
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, sources,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now),
      model: async input => {
        const packet = JSON.parse(input.context);
        expect(packet.sources.find((source: { id: string }) => source.id === 'capability-note').text).toContain(clarification);
        return capture.telegramAnswers.quotes[calls++]!;
      }, send: async input => { sent.push(input.expectedText); return sent.length; }, checkOutbound: () => {} });
    for (let i = 0; i < capture.telegramAnswers.quotes.length; i++) {
      worker.intake([{ update_id: i + 1, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text: capture.question, date: now / 1000 } }]);
      await worker.drain();
    }
    expect(calls).toBe(3);
    expect(sent).toEqual(capture.telegramAnswers.quotes);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('does not infer a Telegram chat from a missing, disabled or other-launcher conversation feature', () => {
  const original = JSON.parse(read(CAPABILITY_BRIEFING_PATH));
  for (const state of ['absent', 'switched-off', 'not-loaded', 'available']) {
    for (const launcher of [CAPABILITY_LAUNCHER, 'another-launcher']) {
      const features = original.launchers[CAPABILITY_LAUNCHER].filter((f: { id: string }) => f.id !== 'preview-conversation');
      if (state !== 'absent') features.push({ ...original.launchers[CAPABILITY_LAUNCHER].find((f: { id: string }) => f.id === 'preview-conversation'), availability: state });
      const data = { ...original, launchers: { [launcher]: features } };
      const note = capabilityBriefing(() => JSON.stringify(data), capture.limits, launcher).text;
      expect(note.includes(clarification)).toBe(state === 'available' && launcher === CAPABILITY_LAUNCHER);
      expect(note).toContain(state === 'available' && launcher === CAPABILITY_LAUNCHER ? clarification : 'Telegram conversations');
    }
  }
  expect(capabilityBriefing(() => 'bad json', capture.limits).text).not.toContain('this chat uses the Telegram bot');
});
