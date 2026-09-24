import { expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { offlineStage2 } from './stage2-fixture.js';
import { acceptStage2Answer, openStage2Reply } from './stage2-owners.js';
import { value } from '../facts/fixtures.js';

it('uses amended live settings through genuine Seven Eight Nine and preserves UNKNOWN original accounting', async () => {
  const s = offlineStage2();
  const p = s.f.prepare();
  expect(p.request.payload).toMatchObject({ maxInputBytes: 4096, maxOutputBytes: 16384,
    maxTokens: 2048, maxCaptureBytes: 1048576, maxCharge: 0, timeout: 120000, deadline: 300100 });
  value(await s.f.api.dispatch(p.request, s.f.fence));
  const slots = readdirSync(join(s.directory, 'captures/capacity')).filter(name => name.endsWith('.json') && name !== 'policy.json')
    .map(name => JSON.parse(readFileSync(join(s.directory, 'captures/capacity', name), 'utf8'))).filter(row => Number.isSafeInteger(row.maxBytes));
  expect(slots.map(row => row.maxBytes).sort((a, b) => a - b)).toEqual([8192, 8192, 16384, 87384, 210264]);
  expect(slots.reduce((sum, row) => sum + row.maxBytes, 0)).toBe(330416);
  const accepted = acceptStage2Answer(s.f);
  expect(accepted.settlement).toMatchObject({ finalCharge: null, delayedExecutionExcluded: false });
  expect(accepted.accounting).toMatchObject({ actualCharge: -1, unresolved: 1, released: 0, retryEligible: 0, exposure: 0 });
  const opened = openStage2Reply(s.f, accepted.acceptance);
  expect(s.calls()).toBe(1);
  expect(opened.reply.id).not.toBe(s.f.id);
  expect(s.f.seven.prepare({ ...s.f.question, run: { owner: 'part-five', name: 'Run', id: opened.reply.id } }, s.f.fence).kind).toBe('Refused');
  expect(s.calls()).toBe(1);
  expect(value(s.f.graph.read(s.f.id)).pending).toHaveLength(1);
}, 60000);

import { stage2CompositionFixture } from './stage2-fixture.js';
it('composes exact Four input to one signed accepted answer in the bound private chat', async () => {
  const s = stage2CompositionFixture(); const c = await s.create();
  try {
    c.pollOnce(); await c.resume();
    expect(c.sidecar.read()).toMatchObject({ phase: 'api-accepted', terminalLatch: true, modelAttemptUsed: 1 });
    expect(s.models).toHaveLength(1);
    const facts = JSON.parse(readFileSync(join(s.root, '.preview-stage2/facts.json'), 'utf8'));
    const evidence = (predicate: string) => facts.find((f: any) => f.body.evidence?.claim.predicate === predicate).body.evidence;
    expect(evidence('provider-response-source-contract').claim.value).toEqual({ version: s.activation.profileDigest,
      parserReference: 'claude-code-json-result', parserVersion: '1', endpoint: s.profile.loginProfileIdentity,
      account: s.profile.expectedAccount, credentialReference: s.profile.reference, controller: 'preview-local-recorder',
      executableArtifact: s.profile.artifact, provider: 'anthropic', model: s.model, route: 'preview-subscription' });
    expect(evidence('provider-response-terminal-contract').claim.value).toEqual({ version: s.activation.profileDigest,
      parserReference: 'claude-code-json-result', parserVersion: '1', terminalReasonField: 'subtype', successfulFinalReplyReasons: ['success'] });
    const binding = evidence('preview-invocation-binding');
    expect(Object.keys(binding.claim.value).sort()).toEqual(['schemaVersion', 'activationReference', 'activationDigest',
      'profileDigest', 'invocationPolicyDigest', 'systemPromptDigest', 'framing', 'invocationPolicy', 'request', 'prepared',
      'effectRequest', 'run', 'attempt', 'submitted', 'submittedDigest'].sort());
    expect(binding).toMatchObject({ source: 'probe', strength: 'attestation' });
    expect(readFileSync(join(s.root, '.preview-stage2/captures', binding.capture.hash.slice(7)), 'utf8')).toBe(encoded(binding.claim.value).bytes);
    const dispatched = JSON.parse(s.models[0].stdin);
    const context = JSON.parse(dispatched.messages[1].content);
    expect(Buffer.byteLength(s.models[0].stdin)).toBeLessThanOrEqual(4096);
    expect(context.conversation[0].message.text).toBe('What is two plus two?');
    expect(Object.keys(context).sort()).toEqual(['bindings', 'conversation', 'conversationKind']);
    expect(context.conversationKind).toBe('captured-telegram-updates');
    expect(s.models[0].args).toEqual(subscriptionInvocationPolicy(s.model).args);
    expect(inputMeasurements('', '', s.models[0].stdin).prompt).toBeLessThanOrEqual(4096);
    expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(1);
    expect(s.calls.find(row => row.method === 'sendMessage').body.text).toContain('Four. café &lt;世界&gt; &amp; ready');
    expect(c.pollOnce()).toBeNull(); await c.resume(); expect(s.models).toHaveLength(1);
  } finally { c.close(); }
}, 60000);

import { encoded, inputMeasurements, requireOutboundBound, subscriptionInvocationPolicy } from './stage2-provider.js';
import { createProviderJudgmentPort } from '../../src/judgment/index.js';
import { privateKey } from '../facts/fixtures.js';
import { acceptedReplyPreviewText } from '../../src/rungraph/index.js';

it('admits exactly 4096 combined UTF-8 prompt bytes including Unicode and JSON escaping; refuses 4097', async () => {
  const prefix = '世界"\n';
  const seed = offlineStage2({ question: prefix });
  const room = 4096 - inputMeasurements('', '', seed.f.submitted).prompt;
  const exact = offlineStage2({ question: prefix + 'x'.repeat(room) });
  expect(inputMeasurements(exact.f.question.question, exact.f.question.context, exact.f.submitted).prompt).toBe(4096);
  const p = exact.f.prepare(); value(await exact.f.api.dispatch(p.request, exact.f.fence));
  expect(exact.calls()).toBe(1);
  const over = offlineStage2({ question: prefix + 'x'.repeat(room + 1) });
  expect(() => over.f.prepare()).toThrow('complete input bound'); expect(over.calls()).toBe(0);
}, 60000);

it('Eight independently rejects a declared input maximum of 4097 even for a short actual envelope', () => {
  const s = offlineStage2();
  Object.assign(s.f.jh, { description: { ...s.f.jh.description, maxInputBytes: 4097 } });
  expect(Buffer.byteLength(s.f.submitted)).toBeLessThan(4096);
  expect(() => s.f.prepare()).toThrow('provider bound exceeded');
  const request: any = s.f.all().find(row => row.kind === 'judgment-provider-ProviderJudgmentRequest');
  expect(request.body.record.maxInputBytes).toBe(4097);
  expect(s.calls()).toBe(0);
}, 60000);

it('accepts a complete Decision larger than the input ceiling while projecting a brief answer', async () => {
  const s = offlineStage2({ reason: 'r'.repeat(5000) }); const p = s.f.prepare();
  value(await s.f.api.dispatch(p.request, s.f.fence)); const a = acceptStage2Answer(s.f);
  const r: any = openStage2Reply(s.f, a.acceptance);
  expect(Buffer.byteLength(r.accepted.answer)).toBeGreaterThan(4096);
  expect(Buffer.byteLength(r.accepted.answer)).toBeLessThanOrEqual(16384);
  expect(acceptedReplyPreviewText(s.f.all(), r.reply.id)).toContain('café &lt;世界&gt; &amp; ready');
}, 60000);

it('refuses unavailable backing response capacity before a physical model launch', async () => {
  const s = offlineStage2(); const p = s.f.prepare();
  value(s.f.captures.put('x'.repeat(900000), 900000));
  expect((await s.f.api.dispatch(p.request, s.f.fence)).kind).toBe('Refused'); expect(s.calls()).toBe(0);
}, 60000);

it('measures the complete canonical outbound envelope at 4096/4097 while both texts alone fit', () => {
  const base = { type: 'OutboundMessage', schemaVersion: 1, id: 'message', semanticMessage: 'answer', run: 'run',
    speaker: 'speaker', account: 'bot', conversation: 'private', sourceResult: 'acceptance', purpose: 'ordinary-reply', text: '世界 &lt;&amp;&gt;\n' };
  const room = 4096 - Buffer.byteLength(encoded(base).bytes);
  const exact = { ...base, text: base.text + 'a'.repeat(room) };
  expect(Buffer.byteLength(requireOutboundBound(exact, 4096))).toBe(4096);
  const over = { ...exact, text: exact.text + 'a' };
  expect(Buffer.byteLength(over.text)).toBeLessThan(4096);
  expect(() => requireOutboundBound(over, 4096)).toThrow('complete outbound bound');
});

it('holds complete-input overflow before model launch and retains exact selected input after restart', async () => {
  const question = '世界"\n' + 'x'.repeat(2500);
  const s = stage2CompositionFixture({ question }); let c = await s.create();
  try {
    c.pollOnce(); await c.resume();
    const held = c.sidecar.read();
    expect(held).toMatchObject({ phase: 'held', modelAttemptUsed: 0, hold: { code: 'BOUND' } });
    expect(held.hold.lengths.submitted).toBeGreaterThan(4096);
    expect(JSON.parse(c.storage.captures.read(held.contextReferences[0])).message.text).toBe(question);
    c.close(); c = await s.create(); await c.resume(); expect(c.sidecar.read()).toEqual(held);
    expect(s.models).toHaveLength(0); expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(0);
  } finally { c.close(); }
}, 60000);

it('enforces full outbound 4096/4097 through actual paired Telegram preparation with Unicode/HTML expansion', async () => {
  const seed = '世界<&>\n'; let room = 0;
  for (const delta of [null, 0, 1]) {
    const answer = delta === null ? seed : seed + 'x'.repeat(room + delta);
    const s = stage2CompositionFixture({ answer }); const c = await s.create();
    try {
      c.pollOnce(); await c.resume();
      const rows = JSON.parse(readFileSync(join(s.root, '.preview-stage2/facts.json'), 'utf8'));
      if (delta === null) {
        const message = rows.find((row: any) => row.kind === 'effect-OutboundMessage').body.record;
        room = 4096 - Buffer.byteLength(encoded(message).bytes);
      } else if (delta === 0) {
        const message = rows.find((row: any) => row.kind === 'effect-OutboundMessage').body.record;
        expect(Buffer.byteLength(encoded(message).bytes)).toBe(4096);
        expect(c.sidecar.read().phase).toBe('api-accepted');
      } else {
        expect(Buffer.byteLength('PREVIEW — experimental test agent; production safeguards incomplete.\n' + answer)).toBeLessThan(4096);
        expect(c.sidecar.read().phase).toBe('held');
        expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(0);
        expect(c.pollOnce()).toBeNull(); await c.resume(); expect(s.models).toHaveLength(1);
      }
    } finally { c.close(); }
  }
}, 120000);

for (const neighbor of ['sender', 'chat', 'topic', 'cutoff', 'bot'] as const) it(`stage2 rejects wrong ${neighbor} without model or send`, async () => {
  const message: any = { message_id: 1001, from: { id: 7812716706, is_bot: false, first_name: 'Offline' },
    chat: { id: 7812716706, type: 'private' }, date: 1790000000, text: 'short question' };
  if (neighbor === 'sender') message.from.id = 17;
  if (neighbor === 'chat') message.chat.id = 17;
  if (neighbor === 'topic') message.message_thread_id = 17;
  if (neighbor === 'cutoff') message.date -= 10;
  const s = stage2CompositionFixture({ updates: [{ update_id: 1, message }], ...(neighbor === 'bot' ? { bot: { id: 17 } } : {}) });
  if (neighbor === 'bot') await expect(s.create()).rejects.toThrow();
  else { const c = await s.create(); try { if (neighbor === 'topic') expect(() => c.pollOnce()).toThrow('non-forum'); else c.pollOnce();
    await c.resume(); expect(c.sidecar.read().modelAttemptUsed).toBe(0); }
    finally { c.close(); } }
  expect(s.models).toHaveLength(0); expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(0);
});
it('holds original context overflow and a known subscription limit without retry or fallback', async () => {
  for (const options of [{ configuration: { maxContextBytes: 1 } },
    { terminal: JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true }) }]) {
    const s = stage2CompositionFixture(options), c = await s.create();
    try { c.pollOnce(); await c.resume(); expect(c.sidecar.read().phase).toBe('held');
      const before = s.models.length; await c.resume(); expect(s.models).toHaveLength(before);
      expect(s.models).toHaveLength('terminal' in options ? 1 : 0);
      expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(0);
    } finally { c.close(); }
  }
}, 60000);

it('refuses acceptance after lease loss during pending provider work without another invocation', async () => {
  let s: ReturnType<typeof offlineStage2>;
  s = offlineStage2({ onInvoke: () => value(s.f.six.release('preview-pending-release', s.f.fence)) });
  const prepared = s.f.prepare();
  await s.f.api.dispatch(prepared.request, s.f.fence);
  expect(s.calls()).toBe(1);
  expect(() => acceptStage2Answer(s.f)).toThrow();
  expect(s.f.all().some(row => row.kind === 'judgment-provider-ProviderAnswerAcceptance')).toBe(false);
  expect((await s.f.api.dispatch(prepared.request, s.f.fence)).kind).toBe('Refused');
  expect(s.calls()).toBe(1);
}, 60000);

for (const event of ['stop', 'expiry', 'revoked', 'short-window'] as const)
  it(`stage2 ${event} before selection produces no model call or send`, async () => {
    const s = stage2CompositionFixture();
    if (event === 'stop') s.state.latchStop('operator');
    if (event === 'expiry') s.time(s.state.read().trial.expiresAt);
    if (event === 'short-window') s.time(s.state.read().trial.expiresAt - 299999);
    if (event === 'revoked') {
      s.revoke(); const c = await s.create();
      try { expect(c.pollOnce()).toBeNull(); await c.resume(); expect(c.sidecar.read().phase).toBe('held'); }
      finally { c.close(); }
    } else await expect(s.create()).rejects.toThrow();
    expect(s.models).toHaveLength(0); expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(0);
  });
