import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SELF_DESCRIPTION_GUIDANCE, CAPABILITY_BRIEFING_PATH, CAPABILITY_LAUNCHER, capabilityBriefing, sourcePacket, SOURCE_PINS } from './briefing.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import type { ReplyCheckResult } from './reply-check.js';

const read = (path: string) => readFileSync(path, 'utf8');
const limits = { providerAttempts: 30, expiresAt: 9999999999999 };
const banned = /\b(?:journals?|doorways?|model calls?|sessions?|Claude Code|reply-only|status commands?|captures?|grant ids?)\b/iu;
const live = JSON.parse(read('tests/preview/fixtures/self-knowledge-live-2026-10-10.json')) as {
  update: number; question: string; answer: string; delivered: string; previousBriefing: string;
  checks: (ReplyCheckResult & { scores?: Record<string, number> })[] };

it.each([false, true])('describes Instar 2.0 and live outcomes without builder terms (tools=%s)', tools => {
  const note = capabilityBriefing(read, { ...limits, tools, mcp: 0 }).text;
  expect(note).toContain(`Instar 2.0 agent (software version ${JSON.parse(read('package.json')).version})`);
  for (const text of ['Instar is the software that helps me stay the same agent over time',
    'memory, values and commitments', 'across conversations and restarts',
    'build on our work together instead of starting over',
    'I remember what matters across all our conversations', 'tell me if I have something wrong, or ask me to forget it',
    'keep track across topics', 'reminders and repeating tasks', 'photos, voice and files']) expect(note).toContain(text);
  expect(note).not.toMatch(banned);
  expect(note).not.toMatch(/\b(?:Claude|Codex|GPT(?:-\w+)?|Opus|Sonnet|Gemini|Haiku)\b/iu);
  expect(note).not.toMatch(/restricted by default|this conversation/u);
  expect(note.includes('I can find things out on the web')).toBe(tools);
  expect(note.includes('work with files and documents, run commands and tasks')).toBe(tools);
  expect(note.includes('you can turn these tools on')).toBe(!tools);
  if (tools) expect(note).toContain('Account connections are off here; you can turn them on.');
});

it.each([SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT])(
  'both answer routes explain identity in the person’s language without naming their underlying software', prompt => {
    expect(prompt).toContain("Explain what you are, what Instar is, why it is different and what you can do from the current capability-note, in everyday words in the person's language.");
    expect(prompt).toContain('Never name your harness or model when describing yourself.');
    expect(prompt).not.toMatch(/\b(?:Claude|Codex|GPT(?:-\w+)?|Opus|Sonnet|Gemini|Haiku)\b/iu);
  });

it('takes feature availability from the generated inventory, with available, off, unloaded and missing neighbors', () => {
  const original = JSON.parse(read(CAPABILITY_BRIEFING_PATH));
  for (const availability of ['available', 'switched-off', 'not-loaded']) {
    const data = structuredClone(original);
    data.launchers[CAPABILITY_LAUNCHER].find((f: { id: string }) => f.id === 'preview-requested-actions').availability = availability;
    const note = capabilityBriefing(path => path === CAPABILITY_BRIEFING_PATH ? JSON.stringify(data) : read(path), limits).text;
    expect(note.includes('I can keep reminders and repeating tasks')).toBe(availability !== 'not-loaded');
    expect(note.split('Other options off here')[0]!.includes('I can keep reminders')).toBe(availability === 'available');
  }
  const missing = capabilityBriefing(path => path === CAPABILITY_BRIEFING_PATH ? '{}' : read(path), limits).text;
  expect(missing).toContain('Instar 2.0 agent (software version');
  expect(missing).toContain('capability briefing is unavailable');
  expect(missing).not.toContain('I can keep reminders');
});

it('keeps the real failure as evidence and instructs both routes to explain outcomes and research needed facts', () => {
  expect(live.update).toBe(969390343);
  expect(live.question).toContain('what an Instar 2.0 agent is');
  expect(live.delivered).toContain('developing the next version of me');
  expect(live.delivered).toMatch(banned);
  expect(live.previousBriefing).toContain('Claude Code');
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain('Unless the operator explicitly asks for internals');
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain('without asking permission again');
});

// Replay the exact recorded model and review results through today's worker. This proves
// the changed prompt reaches the model, not that replaying an old answer can improve it.
// Separate real-model reruns in the desk evidence demonstrate the new answer shape.
it.each([false, true])('replays update 969390343 and its Jev/stronger verdicts with the current briefing (tools=%s)', async tools => {
  const directory = mkdtempSync(join(tmpdir(), 'self-knowledge-'));
  const journal = openPreviewJournal(join(directory, 'journal.encrypted'), new Uint8Array(32).fill(17), {
    kind: 'genesis', bot: '12345678', chat: '-1001234', forum: true, operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: limits.expiresAt,
    maxCalls: limits.providerAttempts, maxReplies: 10, maxTurns: 10, maxBytes: 65536, cursor: 0,
  });
  const sent: string[] = [], notes: string[] = [];
  const worker = createJournalWorker(journal, {
    now: () => 1791672000000, stopped: () => false, toolRoute: () => tools,
    sources: () => sourcePacket(read, SOURCE_PINS, { ...limits, tools, mcp: 0 }).sources,
    model: async input => {
      const packet = JSON.parse(input.context);
      notes.push(packet.sources.find((s: { id: string }) => s.id === 'capability-note').text);
      expect(packet.capability).toContain(SELF_DESCRIPTION_GUIDANCE);
      return live.answer;
    },
    replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
        Object.entries(live.checks[0]!.scores!).map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 0 }),
      escalate: async () => {
        const result = live.checks[1]!;
        if (result.verdict !== 'pass' && result.verdict !== 'violation') throw Error('recorded review is not decisive');
        return { ...result, verdict: result.verdict };
      },
    },
    checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
  });
  try {
    worker.intake([{ update_id: live.update, message: { chat: { id: -1001234, type: 'supergroup', is_forum: true },
      from: { id: 7654321 }, message_thread_id: 20, text: live.question } }]);
    await worker.drain(); await worker.drain();
    expect(notes).toEqual([capabilityBriefing(read, { ...limits, tools, mcp: 0 }).text]);
    expect(journal.view.order[0]!.replyChecks?.map(check => check.verdict)).toEqual(['violation', 'pass']);
    expect(sent).toEqual([live.delivered]);
  } finally { journal.close(); rmSync(directory, { recursive: true, force: true }); }
});

it('preserves historical real-model reruns of the 16:16 question as evidence of the earlier wording', () => {
  const replay = JSON.parse(read('tests/preview/fixtures/self-knowledge-model-replays-2026-10-10.json')) as {
    update: number; runs: { name: string; tools: boolean; finalSystem: boolean; raw: string; answer: string }[] };
  expect(replay.update).toBe(live.update);
  // Preserve the failed prompt placements as evidence; the final system framing fixes these samples.
  for (const run of replay.runs.filter(run => ['answer-off', 'answer-off-r2', 'answer-off-r3'].includes(run.name))) expect(run.answer).toMatch(banned);
  const final = replay.runs.filter(run => run.finalSystem);
  expect(final.map(run => run.tools).sort()).toEqual([false, true]);
  for (const run of final) {
    expect(JSON.parse(run.raw).answer).toBe(run.answer);
    expect(run.answer).toContain('Instar 2.0');
    expect(run.answer).toContain('0.1.0');
    expect(run.answer).toMatch(/coherence/iu);
    expect(run.answer).toMatch(/conversations/iu);
    expect(run.answer).toMatch(/forget|forgotten/iu);
    expect(run.answer).toMatch(/framework/iu);
    expect(run.answer).toMatch(/reminders/iu);
    expect(run.answer).not.toMatch(banned);
    expect(run.answer).not.toMatch(/restricted by default|developing the next version of me/iu);
    if (run.tools) {
      expect(run.answer).toMatch(/web/iu);
      expect(run.answer).toMatch(/files/iu);
      expect(run.answer).toMatch(/commands|tasks/iu);
    } else {
      expect(run.answer).toMatch(/turned off|off here/iu);
      expect(run.answer).toMatch(/turn(?:ed)? (?:them|on)|enabled/iu);
    }
  }
});
