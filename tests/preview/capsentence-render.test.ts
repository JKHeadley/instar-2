import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { CAPABILITY_SENTENCE_LABEL, CAPABILITY_SENTENCE_MARKER, capabilitySentence, SOURCE_PINS, sourcePacket } from './briefing.js';
import { renderCapabilityReply, renderCapabilityRevision } from './capability-render.js';
import type { ReplyRule } from './reply-check.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/capsentence-render-2026-10-12.json', import.meta.url), 'utf8'));
const note = { id: 'capability-note', ...captured.capabilityNote };
const sentence = note.text.split('\n').find((line: string) => line.startsWith(CAPABILITY_SENTENCE_LABEL)).slice(CAPABILITY_SENTENCE_LABEL.length);
const expectedNote = (text: string) => {
  const lines = text.split('\n');
  const publicLines = lines.slice(lines.indexOf('Capabilities:'), lines.indexOf('Internal:'));
  const limits = lines.slice(lines.indexOf('Internal:') + 1).filter(line => !line.startsWith('- '));
  return [...publicLines.slice(0, -1), '', publicLines.at(-1)!.slice(CAPABILITY_SENTENCE_LABEL.length), '', ...limits].join('\n');
};
const canonical = expectedNote(note.text);
// Telegram renders list markers after the canonical capability text has passed review.
const deliveredCanonical = canonical.replace(/^- /gm, '• ');

async function deliver(answer: string, revision?: string, question = captured.question, violation: ReplyRule = 'raw_path') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'capsentence-render-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(52), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 8, maxReplies: 4, maxTurns: 4, maxBytes: 131072, cursor: 0 });
  const sent: string[] = [], reviewed: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      sources: () => [note], model: async () => answer, checkOutbound: () => {},
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      send: async input => { sent.push(input.expectedText); return sent.length; },
      replyCheck: { elapsedMs: () => 100,
        jev: async () => ({ value: null, latencyMs: 1 }),
        escalate: async (text, _id, _prompt, _rules, _deadline, operation) => {
          reviewed.push(text);
          return revision !== undefined && operation !== 'revision'
            ? { verdict: 'violation', ruleIds: [violation], confidence: null, latencyMs: 1 }
            : { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 1 };
        },
        ...(revision === undefined ? {} : { revise: async () => ({ state: 'complete' as const, text: revision }) }) } });
    worker.intake([{ update_id: captured.delivered.update, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: question } }]);
    await worker.drain();
    await worker.drain(); // A repeated drain must never send the rendered answer twice.
    return { sent, reviewed, answer: journal.view.order[0]!.answer };
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

it('repairs only the legacy sentence in the recorded 12:24 reply before review and send', async () => {
  expect(captured.delivered.update).toBe(715675677);
  expect(captured.judge).toMatchObject({ verdict: 'FAIL', reason: 'rendered tools/outbound sentence missing, altered or duplicated' });
  expect(sentence).toBe(capabilitySentence({ tools: true, mcp: 0 }));
  expect(captured.delivered.reply).not.toContain(sentence);
  const expected = captured.delivered.reply.replace(sentence.replace('I can use', 'The person can use'), sentence);
  const result = await deliver(captured.delivered.reply);
  expect(result.answer).toBe(expected);
  expect(result.reviewed).toEqual([expected]);
  expect(result.sent).toEqual([expected]);
});

it.each([
  CAPABILITY_SENTENCE_MARKER,
  `${CAPABILITY_SENTENCE_MARKER}\n\n${CAPABILITY_SENTENCE_MARKER}`,
  `${sentence}\n\n${CAPABILITY_SENTENCE_MARKER}`,
  `${CAPABILITY_SENTENCE_MARKER}\n\n${sentence}`,
])('renders a single copy before review and delivery (case %#)', async body => {
  const result = await deliver(JSON.stringify({ reply: `Before.\n\n${body}\n\nAfter.` }));
  const expected = canonical;
  expect(result.answer).toBe(expected);
  expect(result.reviewed).toEqual([expected]);
  expect(result.sent).toEqual([deliveredCanonical]);
});

it.each([{ tools: false }, { tools: true }, { tools: true, mcp: 0 }, { tools: true, mcp: 2 }])(
  'renders the actual route from its generated, hash-bound note: %j', limits => {
    const packet = sourcePacket(path => readFileSync(path, 'utf8'), SOURCE_PINS,
      { providerAttempts: 1000, expiresAt: 1794519600000, ...limits });
    const expected = expectedNote(packet.sources.find(source => source.id === 'capability-note')!.text);
    expect(renderCapabilityReply(`Before.${CAPABILITY_SENTENCE_MARKER}After.`, packet)).toBe(expected);
    expect(renderCapabilityReply(expected, packet)).toBe(expected);
    // Revision/restart resolves the same persisted note, with no current-config read.
    const prompt = JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet }) }] });
    expect(renderCapabilityRevision(`Before.${CAPABILITY_SENTENCE_MARKER}After.`, prompt)).toBe(expected);
  });

it('leaves absent, ambiguous and altered evidence untouched instead of inventing a capability', () => {
  const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
  const withText = (text: string) => ({ ...note, text,
    provenance: { ...note.provenance, excerptSha256: hash(text) } });
  const badNotes = [undefined, { ...note, text: null }, { ...note, text: note.text + 'changed' },
    withText('No rendered record.'), withText(CAPABILITY_SENTENCE_LABEL),
    withText(`${note.text}\n${CAPABILITY_SENTENCE_LABEL}${sentence}`),
    { ...note, provenance: { ...note.provenance, renderedCapabilitySha256: 'sha256:wrong' } },
    { ...note, provenance: { ...note.provenance, path: 'untrusted.json' } }];
  for (const bad of badNotes)
    expect(renderCapabilityReply(CAPABILITY_SENTENCE_MARKER, { sources: bad ? [bad] : [] })).toBe(CAPABILITY_SENTENCE_MARKER);
  expect(renderCapabilityRevision(CAPABILITY_SENTENCE_MARKER, 'invalid')).toBe(CAPABILITY_SENTENCE_MARKER);
  expect(renderCapabilityRevision(CAPABILITY_SENTENCE_MARKER, '{}')).toBe(CAPABILITY_SENTENCE_MARKER);
  // A partial old paragraph is not a protocol match; there is no prose/intent classifier.
  expect(renderCapabilityReply('The person can use files.', { sources: [note] })).toBe('The person can use files.');
  expect(renderCapabilityReply(sentence.replace('I can use', 'The agent can use'), { sources: [note] })).toBe(sentence);
});

it('does not turn an empty answer or ordinary prose into a capability answer', async () => {
  expect(renderCapabilityReply('', { sources: [note] })).toBe('');
  expect(renderCapabilityReply('Hello.', { sources: [note] })).toBe('Hello.');
  const result = await deliver('Hello.');
  expect(result.sent).toEqual(['Hello.']);
});

it('resolves a revised marker before its own review and sends only that reviewed text', async () => {
  const result = await deliver('Look in /Users/me/notes for it.', `Revised.\n\n${CAPABILITY_SENTENCE_MARKER}`);
  expect(result.reviewed).toEqual(['Look in /Users/me/notes for it.', canonical]);
  expect(result.sent).toEqual([deliveredCanonical]);
});

it('preserves recorded non-capability writer, Jev and review shapes, including uncertain/undecided', () => {
  const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
  const shapes = fixture('retrospective-duty-followup-train-1-2026-10-08.json').otherShapes as
    { kind: string; id: string; raw: string }[];
  expect(shapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided',
    'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  expect(shapes.map(row => row.id)).toEqual(['summary:715672480', '715672483', '715672482', '969389570',
    '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const row of shapes) expect(renderCapabilityReply(row.raw, { sources: [note] })).toBe(row.raw);
});

// Exact delivered bytes enter review unchanged; the reviewer requests a revision.
it('repairs the recorded 16:36 grant overclaim through review and explicit revision', async () => {
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/capability-lines-2026-10-12.json', import.meta.url), 'utf8'));
  expect(recorded.delivered.update).toBe(715675709);
  expect(recorded.delivered.reply).toContain('Answer as the operator');
  expect(renderCapabilityReply(recorded.delivered.reply, { sources: [note] })).toBe(recorded.delivered.reply);
  const result = await deliver(recorded.delivered.reply, CAPABILITY_SENTENCE_MARKER, captured.question, 'self_state_claim');
  expect(result.sent).toHaveLength(1);
  expect(result.sent[0]).toContain('• answers the operator in chat/topics;');
  expect(result.sent[0]).not.toContain('as the operator');
  expect(result.reviewed).toEqual([recorded.delivered.reply, canonical]);
});

it('does not retain invented grants around a reference, and is idempotent', () => {
  const input = `I can approve as the operator.\n${CAPABILITY_SENTENCE_MARKER}\nI can spend without limits.`;
  expect(renderCapabilityReply(input, { sources: [note] })).toBe(canonical);
  expect(renderCapabilityReply(canonical, { sources: [note] })).toBe(canonical);
  for (const line of canonical.split('\n').filter(Boolean))
    expect(note.text.includes(line)).toBe(true);
});

it('preserves a reference when note sections are malformed instead of guessing their scope', () => {
  const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
  const bodies = [
    note.text.replace('Capabilities:', 'Missing:'),
    note.text.replace('Capabilities:', 'Capabilities:\nCapabilities:'),
    note.text.replace('Internal:', 'Internal:\nInternal:'),
    note.text.replace('Internal:', 'extra\nInternal:'),
    note.text.replace('- answers the operator', 'answers the operator'),
    note.text.slice(0, note.text.indexOf('Code switched off here:')).trim(),
    note.text + '\n',
  ];
  for (const text of bodies) {
    const altered = { ...note, text, provenance: { ...note.provenance, excerptSha256: hash(text) } };
    expect(renderCapabilityReply(CAPABILITY_SENTENCE_MARKER, { sources: [altered] })).toBe(CAPABILITY_SENTENCE_MARKER);
  }
});

// A literal sentence is a local reference, never authority over adjacent answers.
it.each(['I', 'The person', 'The agent'])('preserves a mixed tools and arithmetic answer (%s)', async subject => {
  const question = 'What tools can you use, and what is 17 × 23?';
  const body = `${sentence.replace('I can use', `${subject} can use`)}\n\n17 × 23 = 391.`;
  const expected = `${sentence}\n\n17 × 23 = 391.`;
  expect(renderCapabilityReply(body, { sources: [note] })).toBe(expected);
  const prompt = JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: { sources: [note] } }) }] });
  expect(renderCapabilityRevision(body, prompt)).toBe(expected);
  const result = await deliver(body, undefined, question);
  expect(result.answer).toBe(expected);
  expect(result.reviewed).toEqual([expected]);
  expect(result.sent).toEqual([expected]);
});

it('keeps repeated literal sentences and their neighboring content for contextual review', () => {
  const body = `Before.\n${sentence}\n17 × 23 = 391.\n${sentence}\nAfter.`;
  expect(renderCapabilityReply(body, { sources: [note] })).toBe(body);
});
