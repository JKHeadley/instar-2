// @ts-nocheck -- physical ports in the process fixture are plain JavaScript.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { capabilityBriefing, SOURCE_PINS, sourcePacket } from './briefing.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { authoritySealKey, sealAuthorityRecord } from './activation-authority.js';
import { subscriptionToolsPolicy } from '../../src/assembly/production-provider.js';
import { encoded } from '../../src/assembly/boundary.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { toolPacketFits } from './tool-turn.mjs';

const read = path => readFileSync(path, 'utf8');
const limits = { providerAttempts: 1000, expiresAt: 1791232800000 };
const note = (tools, forum = true, scheduledTools = false, toolsGranted = tools) =>
  capabilityBriefing(read, { ...limits, tools, mcp: 0, live: { forum, scheduledTools, toolsGranted } }).text;

it('describes resolved tools, schedules, channel and media limits on both sides without inventing access', () => {
  const on = note(true), off = note(false);
  expect(on).toContain('Tools ON: file reads/edits, commands, web fetch/search, subagents.');
  expect(on).toContain('no MCP server, so no logged-in account access');
  expect(on).toContain('network writes and outside sends via the doorway\'s four tests on operator grant');
  expect(off).toContain('Tools OFF (no active grant).');
  expect(off).not.toContain('Tools ON');
  expect(off).not.toContain('full Claude Code set');
  expect(note(false, false, false, true)).toContain('Tools OFF this turn (granted, route unavailable).');
  expect(note(true, false)).toContain('Chat: private; no forum connected.');
  expect(on).toContain('Chat: forum topics.');
  expect(on).toContain('Scheduled tool sessions OFF; listed timed/repeating replies work.');
  expect(note(true, true, true)).toContain('Scheduled tool sessions ON.');
  for (const text of [on, off]) {
    expect(text).toContain('daily or weekdays until cancelled');
    expect(text).toContain('rolling summary');
    expect(text).toContain('Telegram media: captions only; no photo, voice or attachment-content I/O.');
    expect(text).toContain('at most 1000 model attempts');
  }
  // Missing generated descriptions do not erase the resolved launch facts or invent other abilities.
  const unavailable = capabilityBriefing(() => { throw Error('absent'); }, { ...limits, tools: false,
    live: { forum: true, scheduledTools: true, toolsGranted: false } }).text;
  expect(unavailable).toContain('Tools OFF');
  expect(unavailable).toContain('Scheduled tool sessions ON.');
  expect(unavailable).not.toContain('cannot act outside this chat');
});

it('rebuilds the capability source for recorded K11a answer/review packets, retaining their historical bytes', () => {
  // Real recorded prompts from proof-room updates 6232224/6232229, plus the recorded
  // K11a answer/reply-review inputs (update 6232231). This is an offline source replay,
  // not a claim that the changed prompt has been exercised against a live model.
  for (const file of ['recorded-prompt-6232224.json', 'recorded-prompt-6232229.json',
    'k11a-worst-input.json', 'review-describe-input.json', 'review-decline-input.json']) {
    const original = read(`tests/preview/fixtures/selfdesc-2026-10-04/${file}`);
    const envelope = JSON.parse(original);
    const context = envelope.messages.find(item => item.role === 'context');
    const { packet } = JSON.parse(context.content);
    expect(packet.sources.some(item => item.id === 'capability-note')).toBe(true);
    for (const tools of [true, false]) {
      const fresh = sourcePacket(read, SOURCE_PINS, { ...limits, tools, mcp: 0,
        live: { forum: true, scheduledTools: false, toolsGranted: tools } }).sources.find(item => item.id === 'capability-note');
      const replay = { ...packet, sources: packet.sources.map(item => item.id === fresh.id ? fresh : item) };
      expect(replay.sources.find(item => item.id === fresh.id).text).toBe(note(tools));
      expect(replay.sources.filter(item => item.id !== fresh.id)).toEqual(packet.sources.filter(item => item.id !== fresh.id));
      expect(replay.operatorMessage).toBe(packet.operatorMessage);
      expect(replay.candidateReply).toBe(packet.candidateReply);
    }
    expect(read(`tests/preview/fixtures/selfdesc-2026-10-04/${file}`)).toBe(original);
  }
});

it('the real launcher briefs its resolved default-on grant, explicit off, and unavailable identity in the persisted model packet', async () => {
  for (const mode of ['on', 'off', 'identity-unavailable']) {
    const world = successiveWorld();
    // The real launcher, authority resolver, journal and packet construction run. Only
    // physical Telegram/provider IO and the harness identity are replaced.
    const toolModule = join(world.directory, 'tools.mjs'), harnessModule = join(world.directory, 'harness.mjs');
    const loader = join(world.directory, 'selfdesc-loader.mjs');
    const url = path => pathToFileURL(join(process.cwd(), path)).href;
    writeFileSync(toolModule, `export * from ${JSON.stringify(url('tests/preview/tool-turn.mjs'))};
export const runToolTurn = async input => input.fallback();\n`);
    writeFileSync(harnessModule, `export * from ${JSON.stringify(url('tests/preview/harness-user.mjs'))};
export const harnessGate = () => { const state = { ready: true, user: 'offline', runner: 'offline', plan: 'max' };
  return { state, current: () => state }; };\n`);
    writeFileSync(loader, `export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs')) {
    if (specifier === './tool-turn.mjs') return { url: ${JSON.stringify(pathToFileURL(toolModule).href)}, shortCircuit: true };
    if (specifier === './harness-user.mjs') return { url: ${JSON.stringify(pathToFileURL(harnessModule).href)}, shortCircuit: true };
  }
  return next(specifier, context);
}\n`);
    const harness = cutoverHarness(world, offlineProfile, { NODE_OPTIONS: `--loader ${loader}` });
    const authorityPath = join(world.directory, 'activation-authority.json');
    const { seal: _seal, ...authority } = JSON.parse(read(authorityPath));
    const grant = authority.grants[0];
    authority.grants.push({ ...grant, id: 'offline-tools-grant', scope: { ...grant.scope,
      invocationPolicyDigest: encoded(subscriptionToolsPolicy(world.model)).hash } });
    writeFileSync(authorityPath, JSON.stringify(sealAuthorityRecord(authority, authoritySealKey(OFFLINE_STORAGE_KEY))));
    harness.setUpdates([{ update_id: 1, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
      from: { id: Number(world.configuration.operatorSenderId) }, text: 'What can you do in this chat, and what can\'t you do?' } }]);
    const result = await harness.runLive(3, ['--tools', mode === 'off' ? 'off' : 'default',
      ...(mode === 'on' ? ['--harness-user', 'offline'] : [])]);
    expect(result.status, result.stderr).toBe(0);
    if (mode !== 'off') expect(result.stderr).toContain('tools on: grant offline-tools-grant');
    const journal = openPreviewJournal(join(harness.liveRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
    try {
      const turn = journal.view.order.find(item => item.update === 1);
      expect(turn?.prompt).toBeTruthy();
      const packet = JSON.parse(JSON.parse(turn.prompt).messages.find(item => item.role === 'context').content).packet;
      const text = packet.sources.find(item => item.id === 'capability-note').text;
      expect(text).toContain('Chat: private');
      if (mode === 'on') {
        expect(text).toContain('Tools ON: file reads/edits, commands, web fetch/search, subagents.');
        expect(packet.capabilities.externalTools).toBe('listed');
        expect(packet.governingConstraints['no-tools']).toBe('listed tools only');
      } else {
        expect(text).toContain(mode === 'off' ? 'Tools OFF (no active grant).' : 'Tools OFF this turn (granted, route unavailable).');
        expect(text).not.toContain('full Claude Code set');
        expect(packet.capabilities.externalTools).toBe('none');
      }
    } finally { journal.close(); }
  }
}, 120_000);

// Exact live answer and persisted judgments from Justin's group. This exercises the new
// source in the worker; replaying an old answer is not a fresh model quality verdict.
const liveTurn = JSON.parse(read('tests/preview/fixtures/selfdesc-live-2026-10-10.json'));
it.each(['format-retry', 'answer-replace'])('refreshes the capability source and provenance for %s on changed and stable routes', async mode => {
  const timedOut = JSON.parse(read('tests/preview/fixtures/lostanswer-live-2026-10-02.json')).lostFirstCall.callOutcomes[0];
  for (const withdraw of [false, true]) {
    const directory = mkdtempSync(join(tmpdir(), 'selfdesc-retry-'));
    const now = 1791672000000, maxBytes = 65536;
    const journal = openPreviewJournal(join(directory, 'journal.encrypted'), new Uint8Array(32).fill(17), {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 1000, maxReplies: 10, maxTurns: 10, maxBytes, cursor: 0,
    });
    let granted = true;
    const packets = [], sent = [], sourceTurns = [];
    const route = () => granted && toolPacketFits(journal.view);
    const sources = () => sourcePacket(read, SOURCE_PINS, { ...limits, tools: route(), mcp: 0,
      live: { forum: false, scheduledTools: false, toolsGranted: granted } }).sources;
    const worker = createJournalWorker(journal, {
      now: () => now, stopped: () => false, toolRoute: route,
      sources: turn => { sourceTurns.push(turn?.id); return sources(); },
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now, maxBytes),
      model: async input => {
        const packet = JSON.parse(input.context);
        expect(JSON.parse(JSON.parse(input.prepared).messages.find(item => item.role === 'context').content).packet).toEqual(packet);
        expect(Buffer.byteLength(input.prepared)).toBeLessThanOrEqual(maxBytes);
        packets.push(packet);
        if (packets.length > 1) return liveTurn.answer;
        if (withdraw) granted = false;
        if (mode === 'format-retry') return { state: 'complete', failureClass: 'malformed' };
        // Real proof-room timeout outcome (6230665); only the retry route transition is synthetic.
        const { id: _id, role, at: _at, ...outcome } = timedOut;
        journal.append({ kind: 'call-outcome', id: input.id, role, outcome, at: now });
        return { state: 'uncertain' };
      },
      checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
    });
    try {
      worker.intake([{ update_id: liveTurn.update, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text: liveTurn.operatorMessage } }]);
      await worker.drain(); await worker.drain();
      expect(packets).toHaveLength(2);
      const capability = packet => packet.sources.find(source => source.id === 'capability-note');
      expect(packets[0].capabilities.externalTools).toBe('listed');
      expect(capability(packets[0]).text).toContain('Tools ON:');
      expect(packets[1].capabilities.externalTools).toBe(withdraw ? 'none' : 'listed');
      expect(capability(packets[1])).toEqual(sources().find(source => source.id === 'capability-note'));
      expect(capability(packets[1]).provenance.excerptSha256 === capability(packets[0]).provenance.excerptSha256).toBe(!withdraw);
      expect(packets[1].sources.filter(source => source.id !== 'capability-note'))
        .toEqual(packets[0].sources.filter(source => source.id !== 'capability-note'));
      expect(sourceTurns.at(-1)).toBe(journal.view.order[0].id);
      const prompt = journal.view.order[0].prompt;
      expect(JSON.parse(JSON.parse(prompt).messages.find(item => item.role === 'context').content).packet).toEqual(packets[1]);
      expect(sent).toEqual([liveTurn.intent]);
    } finally { journal.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

it.each(['format-retry', 'answer-replace'])('keeps the complete-prompt bound when %s refreshes a larger source', async mode => {
  const directory = mkdtempSync(join(tmpdir(), 'selfdesc-retry-bound-'));
  const now = 1791672000000, maxBytes = 65536;
  const journal = openPreviewJournal(join(directory, 'journal.encrypted'), new Uint8Array(32).fill(17), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 1000, maxReplies: 10, maxTurns: 10, maxBytes, cursor: 0,
  });
  let calls = 0, overflowChecked = false;
  const worker = createJournalWorker(journal, {
    now: () => now, stopped: () => false, toolRoute: () => true,
    sources: () => sourcePacket(read, SOURCE_PINS, { ...limits, tools: true }).sources.map(source =>
      source.id === 'capability-note' && calls ? { ...source, text: 'x'.repeat(maxBytes) } : source),
    prepareModel: input => {
      try { return prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now, maxBytes); }
      catch (error) { if (calls) overflowChecked = true; throw error; }
    },
    model: async input => {
      calls++;
      if (mode === 'format-retry') return { state: 'complete', failureClass: 'malformed' };
      const { id: _id, role, at: _at, ...outcome } = JSON.parse(read(
        'tests/preview/fixtures/lostanswer-live-2026-10-02.json')).lostFirstCall.callOutcomes[0];
      journal.append({ kind: 'call-outcome', id: input.id, role, outcome, at: now });
      return { state: 'uncertain' };
    },
    checkOutbound: () => {}, send: async () => 1,
  });
  try {
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: liveTurn.operatorMessage } }]);
    await worker.drain();
    expect(overflowChecked).toBe(true);
    expect(calls).toBe(1);
    expect(journal.view.calls).toBe(1);
  } finally { journal.close(); rmSync(directory, { recursive: true, force: true }); }
});

it.each([[true, false], [false, false], [true, true], [false, true]])(
  'replays live update 969390342 (tools=%s, synthetic empty-output control=%s)', async (tools, empty) => {
  const directory = mkdtempSync(join(tmpdir(), 'selfdesc-recorded-'));
  const journal = openPreviewJournal(join(directory, 'journal.encrypted'), new Uint8Array(32).fill(17), {
    kind: 'genesis', bot: '12345678', chat: '-1001234', forum: true, operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 65536, cursor: 0,
  });
  const sent = [], packets = [];
  const worker = createJournalWorker(journal, {
    now: () => 1791672000000, stopped: () => false, toolRoute: () => tools,
    sources: () => sourcePacket(read, SOURCE_PINS, { ...limits, tools, mcp: 0,
      live: { forum: true, scheduledTools: false, toolsGranted: tools } }).sources,
    model: async input => { packets.push(JSON.parse(input.context)); return empty ? '' : liveTurn.answer; },
    replyCheck: { elapsedMs: () => 0,
      // Reconstruct only the Jev port envelope from the journal's recorded scores.
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
        Object.entries(liveTurn.checks[0].scores).map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 185 }),
      escalate: async () => liveTurn.checks[1],
    },
    checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
  });
  try {
    worker.intake([{ update_id: liveTurn.update, message: { chat: { id: -1001234, type: 'supergroup', is_forum: true },
      from: { id: 7654321 }, message_thread_id: 3, text: liveTurn.operatorMessage } }]);
    await worker.drain(); await worker.drain();
    expect(packets).toHaveLength(1);
    expect(packets[0].sources.find(source => source.id === 'capability-note').text).toBe(note(tools));
    expect(packets[0].capabilities.externalTools).toBe(tools ? 'listed' : 'none');
    if (empty) {
      // No captured empty delivery exists in the three journals checked read-only on
      // 2026-10-10; this is a synthetic output control, never labelled recorded evidence.
      expect(sent).toHaveLength(1);
      expect(sent.every(text => text.trim().length > 0)).toBe(true);
    } else {
      expect(journal.view.order[0].replyChecks.map(check => check.verdict)).toEqual(['violation', 'pass']);
      expect(sent).toEqual([liveTurn.intent]);
    }
  } finally { journal.close(); rmSync(directory, { recursive: true, force: true }); }
});
