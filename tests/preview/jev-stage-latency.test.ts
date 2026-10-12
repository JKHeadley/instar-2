import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { openPreviewJournal, createJournalWorker, type Turn } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { appendGroupCarry } from './group-carry.js';
import { verifyGroupAudience } from './group-disclosure.js';
import { key, scope, now, permissionFor, membership } from './group-carry-fixture.js';
import { JEV_MODEL, jevQuestions, parseJevResponse, parseReplyReviewVerdict,
  type ReplyRule, type ReplyCheckPorts } from './reply-check.js';
import { assertLiveJudgment, modelCallRecord } from './model-call-boundary.js';
import { readAnswer } from './answer-reading.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/group-audience-live-2026-10-10.json', import.meta.url), 'utf8')) as {
  recorded: { update: number; text: string; answer: string; checks: NonNullable<Turn['replyChecks']> };
  samples: { name: string; raw: string; rules: ReplyRule[] }[];
};
// Execute the shipped client body with physical dependencies injected. This replay uses only
// loopback HTTP and fixed fixture credentials; no serving login or external provider.
const launcher = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const start = launcher.indexOf('    const callJev = async ');
const end = launcher.indexOf('    // model-call-boundary:end', start);
if (start < 0 || end < 0) throw Error('shipped Jev boundary absent');
const clientBody = `${launcher.slice(start, end)}\ncallJev;`;
const rounds = 3; // Both count reads bracket one bounded round of four identity reads.

for (const hostProbe of [false, true]) it(`recorded Jev stage separates HTTP from admission (host probe ${hostProbe})`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'jev-stage-')), path = join(root, 'group');
  const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.operator, operator: scope.operator,
    grant: 'TEST-jev-stage', configurationDigest: 'sha256:test', expires: now + 86400000,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 };
  const source = openPreviewJournal(join(root, 'source'), key, genesis);
  let journal = openPreviewJournal(path, key, { ...genesis, chat: scope.chat, forum: true });
  appendGroupCarry(journal, source, scope, permissionFor(scope), true, now, () => false); source.close();
  let clock = now, reads = 0, probes = 0, peak = 0, active = 0, requests = 0;
  let httpWallMs = 0, clientWallMs = 0, reservationWallMs = 0;
  const sent: string[] = [], captured = fixture.recorded.checks.find(check => check.path === 'jev')!;
  const responseBody = JSON.stringify({ model: JEV_MODEL,
    answers: Object.fromEntries(Object.entries(captured.scores!).map(([rule, noul]) => [rule, { type: 'noul', noul }])),
    usage: { input_tokens: captured.usage!.inputTokens, output_tokens: captured.usage!.outputTokens } });
  const bodies: { state: string; model: string; questions: object }[] = [];
  const server = createServer(async (request, response) => {
    let bytes = ''; for await (const part of request) bytes += String(part);
    bodies.push(JSON.parse(bytes)); requests++;
    response.setHeader('Content-Type', 'application/json'); response.end(responseBody);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('listener absent');
  const audience = async () => {
    probes++;
    return verifyGroupAudience(scope, async (method, body) => {
      reads++; active++; peak = Math.max(peak, active);
      const due = clock + 1000; await Promise.resolve(); clock = Math.max(clock, due); active--;
      return membership()(method, body);
    });
  };
  const sample = fixture.samples.find(sample => sample.name === 'operator-only')!;
  const reading = readAnswer(sample.raw, { wrapped: 'refuse' });
  if (!reading.ok) throw Error('recorded reviewer unreadable');
  const verdict = parseReplyReviewVerdict(reading.value, sample.rules);
  const callJev = runInNewContext(clientBody, {
    requireGroupDisclosure: async () => { if (hostProbe && !await audience()) throw Error('audience refused'); },
    journal, assertLiveJudgment, shared: null, JEV_MODEL, parseJevResponse, AbortSignal,
    performance: { now: () => clock },
    sha256: (body: string) => createHash('sha256').update(body).digest('hex'),
    typesafeKey: () => 'TEST-offline-only', observeJev: () => {},
    recordModelCall: (entry: Parameters<typeof modelCallRecord>[0]) => journal.append(modelCallRecord({ ...entry, at: clock })),
    fetch: async (url: string, init: RequestInit) => {
      expect(new URL(url).hostname).toBe('api.typesafe.ai');
      expect(new URL(url).pathname).toBe('/v1/systemone');
      const began = performance.now(), response = await fetch(`http://127.0.0.1:${address.port}`, init);
      return { ok: response.ok, text: async () => {
        const text = await response.text(); httpWallMs += performance.now() - began;
        clock += captured.latencyMs; return text;
      } };
    },
  }) as (judgment: string, text: string, questions: object, timeout?: number, occurrence?: string) => ReturnType<ReplyCheckPorts['jev']>;
  const append = journal.append.bind(journal);
  journal.append = row => { const begin = performance.now(); const result = append(row);
    if (row.kind === 'reply-jev-reserve') reservationWallMs += performance.now() - begin;
    return result; };
  const ports = { now: () => clock, stopped: () => false, groupDisclosure: audience,
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, clock),
    model: async () => fixture.recorded.answer,
    checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; },
    replyCheck: { elapsedMs: () => clock,
      jev: async (text: string, questions = jevQuestions, timeout?: number, occurrence?: string) => {
        const begin = performance.now(); const result = await callJev('jev-reply-check', text, questions, timeout, occurrence);
        clientWallMs += performance.now() - begin; return result;
      },
      escalate: async () => ({ ...verdict, confidence: null, latencyMs: 0 }),
    },
  };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: fixture.recorded.update, message: { message_id: 1,
      chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true },
      from: { id: Number(scope.operator) }, text: fixture.recorded.text } }]);
    await worker.drain(); const turn = journal.view.order[0]!;
    expect(sent).toEqual([fixture.recorded.answer]);
    expect(requests).toBe(1); expect(Object.keys(bodies[0]!.questions)).toHaveLength(10);
    expect(bodies[0]).toEqual({ state: fixture.recorded.answer, model: JEV_MODEL, questions: jevQuestions });
    expect(turn.replyChecks?.map(check => check.verdict)).toEqual(['pass', 'pass']);
    expect(turn.replyChecks![0]!.scores).toEqual(captured.scores);
    expect(turn.replyChecks![0]!.usage).toEqual(captured.usage);
    const stageMs = turn.reviewReservedAt! - turn.jevReservedAt!;
    expect(stageMs).toBe(rounds * 1000 * (hostProbe ? 2 : 1) + captured.latencyMs);
    expect(reads).toBe(probes * 6); expect(active).toBe(0);
    console.log(JSON.stringify({ update: fixture.recorded.update, hostProbe, stageMs,
      injectedProviderMs: captured.latencyMs, probes, reads, peak, requests, httpWallMs,
      clientWallMs, reservationWallMs, clock: '1000 ms/read; recorded 164 ms provider; other local work zero',
      wall: 'local loopback HTTP and local journal; not live TypeSafe or Studio timings' }));
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain();
    expect(sent).toHaveLength(1); expect(requests).toBe(1);
  } finally {
    journal.close(); await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
