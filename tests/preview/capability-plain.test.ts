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
  expect(answer).toContain('November 12, 2026 at 19:00 UTC');
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
  expect(unknown).toContain('cannot confirm which account connections');
  expect(configured).toContain('2 account connections are configured');
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
