import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sourcePacket, SOURCE_PINS, CAPABILITY_SENTENCE_LABEL } from './briefing.js';
import { renderCapabilityReply, renderCapabilityRevision } from './capability-render.js';
import { readAnswer } from './answer-reading.js';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/capability-plain-2026-10-13.json', import.meta.url), 'utf8'));
const limits = { providerAttempts: 1000, expiresAt: 1794519600000, tools: true, mcp: 0 };
const packet = (overrides = {}) => sourcePacket(path => readFileSync(path, 'utf8'), SOURCE_PINS, { ...limits, ...overrides });
const marker = JSON.parse(recorded.modelOutput).answer;

it('replays the real capability marker and preserves its recorded failure evidence', () => {
  expect(recorded.update).toBe(6233122);
  expect(recorded.capabilityNote.provenance.excerptSha256).toBe('sha256:' + createHash('sha256').update(recorded.capabilityNote.text).digest('hex'));
  expect(renderCapabilityReply(marker, { sources: [recorded.capabilityNote] })).toBe(recorded.answer);
  expect(recorded.answer).toContain('SecretRef');
  expect(readAnswer(recorded.modelOutput, { wrapped: 'accept' })).toMatchObject({ ok: true, value: marker });
  const current = packet();
  const answer = renderCapabilityReply(marker, current);
  expect(answer).toContain('Ask me');
  expect(answer).toContain('remember');
  expect(answer).toContain('remind');
  expect(answer).toContain('look up');
  expect(answer).toContain('No accounts are connected');
  expect(answer).toContain('connect an account');
  expect(answer).toContain('Not enabled here: the separate work coordinator, Slack conversations, Slack replies, another Telegram connection (this bot chat works).');
  expect(answer).not.toContain('Enable these in setup');
  expect(answer).toContain('November 12, 2026 at 21:40 UTC');
  expect(answer).not.toMatch(/SecretRef|epoch ms|effect doorway|MCP|adapter|rungraph/);
  expect(answer).toContain('1000 model attempts');
  const note = current.sources.find(s => s.id === 'capability-note')!;
  const sentence = note.text.split('\n').find(line => line.startsWith(CAPABILITY_SENTENCE_LABEL))!.slice(CAPABILITY_SENTENCE_LABEL.length);
  // The capability judge's exact-paragraph floor stays bound to this turn's note.
  expect(answer.split('\n').filter(line => line === sentence)).toHaveLength(1);
  expect(note.provenance.renderedCapabilitySha256).toBe('sha256:' + createHash('sha256').update(sentence).digest('hex'));
  expect(renderCapabilityReply(answer, current)).toBe(answer);
  const prompt = JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: current }) }] });
  expect(renderCapabilityRevision(marker, prompt)).toBe(answer);
});

it('does not turn missing, unknown or configured connections into account authority', () => {
  const absent = renderCapabilityReply(marker, packet());
  const unknown = renderCapabilityReply(marker, packet({ mcp: undefined }));
  const configured = renderCapabilityReply(marker, packet({ mcp: 2 }));
  expect(absent).toContain('No accounts are connected');
  expect(unknown).toContain('cannot confirm which tool connections');
  expect(configured).toContain('2 tool connections are configured');
  expect(configured).toContain('does not prove that an account is signed in');
  for (const answer of [absent, unknown, configured]) {
    expect(answer).toContain('permission');
    expect(answer).toContain('already allowed');
    expect(answer).toContain('above your limit');
    expect(answer).toContain('cannot be undone and is outside my role');
    expect(answer).toContain('publicly in your name');
    expect(answer).toContain('widens my permissions');
    expect(answer).toContain('marked sensitive');
  }
  const noTools = renderCapabilityReply(marker, packet({ tools: false }));
  expect(noTools).toContain('no tools, browsing or code execution');
  expect(noTools).not.toContain('look up');
  expect(noTools).toContain('remind');
});

it('delivers the recorded model output through reading, rendering and journal review exactly once', async () => {
  const { mkdtempSync, realpathSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createJournalWorker, openPreviewJournal } = await import('./journal.js');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'capability-plain-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(52), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: limits.expiresAt,
    maxCalls: 8, maxReplies: 4, maxTurns: 4, maxBytes: 131072, cursor: 0 });
  const current = packet(), sent: string[] = [], reviewed: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => 1791907116665, stopped: () => false,
      sources: () => current.sources,
      model: async () => {
        const reading = readAnswer(recorded.modelOutput, { wrapped: 'accept' });
        if (!reading.ok) throw Error(reading.defect);
        return reading.value;
      },
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: null, latencyMs: 1 }),
        escalate: async text => { reviewed.push(text); return recorded.review; } } });
    worker.intake([{ update_id: recorded.update, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: recorded.question } }]);
    await worker.drain(); await worker.drain();
    const expected = renderCapabilityReply(marker, current);
    expect(reviewed).toEqual([expected]);
    expect(sent).toEqual([expected]);
    // Replay proves the review/send wiring, not a fresh model judgment of the new prose.
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('preserves recorded non-capability shapes under the new note, including empty and uncertain answers', () => {
  const { otherShapes } = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  expect(otherShapes.map((row: { kind: string }) => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided',
    'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  for (const row of otherShapes) expect(renderCapabilityReply(row.raw, packet())).toBe(row.raw);
});

it('only offers the features actually available in the generated inventory', () => {
  const path = 'generated/capabilities.json';
  const inventory = JSON.parse(readFileSync(path, 'utf8'));
  const features = inventory.launchers['tests/preview/journal-agent.mjs'];
  const reminders = features.find((feature: { id: string }) => feature.id === 'preview-requested-actions');
  expect(renderCapabilityReply(marker, packet())).toContain(reminders.text);
  for (const availability of ['not-loaded', 'switched-off']) {
    reminders.availability = availability;
    const withoutReminders = sourcePacket(file => file === path ? JSON.stringify(inventory) : readFileSync(file, 'utf8'),
      SOURCE_PINS, limits);
    expect(renderCapabilityReply(marker, withoutReminders)).not.toContain(reminders.text);
  }
});
