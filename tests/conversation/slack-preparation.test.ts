import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { createSlackApiClient } from '../../src/conversation/slack-api.js';
import { prepareSlackIntake } from '../../src/assembly/production-slack.js';
import { createHeldSlackReplyOperation, createSlackIngress, extractSlackEnvelope,
  slackParserDeclarationId } from '../../src/conversation/slack.js';
import type { SlackSelection } from '../../src/conversation/slack.js';
import { sanitizeDisplayName, validateChannelId, escapeMrkdwn } from '../../src/conversation/slack-sanitize.js';
import { intakeFixture, refused, value } from '../intake/fixtures.js';

const selection: SlackSelection = { app: 'A12345678', team: 'T12345678', bot: 'B12345678',
  operator: 'U12345678', principal: 'alice', channel: 'D12345678', thread: null, epoch: 'socket:1' };
const raw = readFileSync('tests/conversation/fixtures/slack/dm-message.json', 'utf8').trim();
const changed = raw.replace('hello from Slack', 'changed payload');
function setup(directory?: string, bind = true) {
  const f = intakeFixture(directory ? { directory } : {});
  const parser = JSON.parse(readFileSync('src/conversation/slack.parser.json', 'utf8')) as object[];
  Object.assign(f.r.context, { references: [...f.r.context.references ?? [],
    { provider: 'fixture', id: 'P12-SLACK-ENVELOPE-CAPTURE', kind: 'captured-bytes' },
    { provider: 'fixture', id: 'P12-SLACK-PREPARATION' },
    { provider: 'fixture', id: 'P12-SLACK-REPLY-HELD' }] });
  const features = JSON.parse(readFileSync('src/conversation/slack.declarations.json', 'utf8')) as object[];
  const governed = f.govern([...f.registerInput.sources.map(source => source.declaration), ...parser, ...features]);
  const hostPort = value(createIntakePort({ ...f.deps, governance: governed.governance }));
  Object.assign(f.context, { decode: { ...f.context.decode, register: { ...f.context.decode.register,
    entries: [...f.context.decode.register.entries, slackParserDeclarationId],
    methods: [...f.context.decode.register.methods, 'telegram-sender'] } } });
  const route = extractSlackEnvelope(raw, selection).route;
  if (bind) f.bind({ adapter: slackParserDeclarationId, channel: route.channel, sender: route.sender,
    identityEpoch: route.identityEpoch, principalId: 'alice' });
  let current = 'socket:1';
  const proof = f.f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity', true);
  f.syncCaptures();
  const socket = { owner: 'part-ten' as const, app: selection.app, team: selection.team, bot: selection.bot, incarnation: 'socket:1', currentIncarnation: () => current,
    authenticate: () => { f.trace.push('authenticate'); return f.f.success({ ...proof.input, adapter: slackParserDeclarationId, evidence: { kind: 'channel' as const, authenticated: true } }); },
    readCapture: (reference: string) => f.f.success(f.f.captures[reference] ?? ''),
  };
  const boundary = { site: 'intake.admit', preserved: f.context.preserved, register: f.context.decode.register };
  const deps = { ...f.deps, governance: governed.governance };
  const facts = createFactStore(f.context, f.storage);
  const ack: string[] = [];
  const prepared = prepareSlackIntake({ shared: deps, selection, socket, boundary,
    acknowledge: envelope => { ack.push(envelope); return f.f.success(undefined); } });
  if ('kind' in prepared) throw new Error(prepared.detail);
  const { intake, ingress, adapter } = prepared;
  return { f, deps: { ...deps, adapter }, intake, facts, ingress, ack, boundary, socket, hostPort, setCurrent: (next: string) => { current = next; } };
}

describe('Slack preparation', () => {
  it('ports the pure sanitize rules without turning a display name into a mention', () => {
    expect(sanitizeDisplayName('<@U12345678>\n Alice')).toBe('@U12345678 Alice');
    expect(escapeMrkdwn('<@U12345678>')).toBe('&lt;@U12345678&gt;');
    expect(validateChannelId('D12345678')).toBe(true);
    expect(validateChannelId('../etc')).toBe(false);
    expect(JSON.parse(readFileSync('src/conversation/slack.declarations.json', 'utf8'))).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'slack-ordinary-reply', status: 'dark',
        profile: expect.objectContaining({ reversibility: 'irreversible' }) })]));
  });
  it('extracts stable event identity separately from the delivery envelope', () => {
    const first = extractSlackEnvelope(raw, selection);
    const retry = extractSlackEnvelope(raw.replace('"retry_attempt":0', '"retry_attempt":1'), selection);
    expect(retry.route).toEqual(first.route);
    expect(retry.envelopeId).toBe(first.envelopeId);
    expect(extractSlackEnvelope(changed, selection).route).toEqual(first.route);
  });
  it('writes the exact envelope capture and receipt before ack, then uses the shared intake owner', () => {
    const s = setup();
    value(s.hostPort.receive('{"schemaVersion":1,"kind":"message","text":"host"}',
      { channel: 'chat-a', sender: 'platform-alice', identityEpoch: 'account-1', eventId: 'host-event' }));
    const result = value(s.ingress.receive(raw));
    expect(result.disposition).toBe('admitted');
    expect(s.ack).toEqual(['Ev1']);
    const kinds = value(s.facts.read()).map(f => f.kind);
    expect(kinds.filter(kind => kind === 'intake-receipt')).toHaveLength(2);
    expect(kinds).toContain('intake-admitted');
    expect(s.f.trace.indexOf('capture')).toBeLessThan(s.f.trace.indexOf('append:intake-receipt'));
    expect(s.f.trace.indexOf('append:intake-receipt')).toBeLessThan(s.f.trace.indexOf('authenticate'));
  });
  it('restarts the intake port over the same owner store and detects changed bytes under the same event id', () => {
    const first = setup(mkdtempSync(join(tmpdir(), 'slack-prep-')));
    value(first.ingress.receive(raw));
    const restarted = value(createIntakePort(first.deps));
    const ack: string[] = [];
    const second = createSlackIngress({ selection, socket: first.socket, intake: restarted,
      facts: first.facts, observer: first.deps.author.principal.id, boundary: first.boundary,
      acknowledge: envelope => { ack.push(envelope); return first.f.f.success(undefined); } });
    expect(value(second.receive(raw)).disposition).toBe('duplicate');
    // The owner currently compares original bytes, so changed delivery metadata is held by row 57.
    expect(value(second.receive(changed)).disposition).toBe('held');
    expect(ack).toEqual(['Ev1', 'Ev1']);
    expect(value(first.facts.read()).some(f => f.kind === 'intake-mismatch')).toBe(true);
  });
  it('does not ack without durable receipt or after stale socket fencing', () => {
    const s = setup();
    const failed = createIntakePort({ ...s.deps, storage: { ...s.f.storage, append() { throw new Error('disk down'); } } });
    const port = value(failed);
    const noReceipt = createSlackIngress({ selection, socket: { owner: 'part-ten', app: selection.app, team: selection.team, bot: selection.bot, incarnation: 'socket:1',
      currentIncarnation: () => 'socket:1', authenticate: () => s.f.f.success({} as never),
      readCapture: reference => s.f.f.success(s.f.f.captures[reference] ?? '') },
      intake: port, facts: s.facts, observer: s.deps.author.principal.id,
      boundary: s.boundary, acknowledge: envelope => { s.ack.push(envelope); return s.f.f.success(undefined); } });
    refused(noReceipt.receive(raw), 'no durable owner receipt');
    expect(s.ack).toEqual([]);
    s.setCurrent('socket:2');
    refused(s.ingress.receive(raw), 'stale Slack socket incarnation');
    expect(s.ack).toEqual([]);
  });
  it('holds a different sender and refuses a local reply before any client call', () => {
    const s = setup();
    const stranger = raw.replace('U12345678', 'U99999999');
    expect(value(s.ingress.receive(stranger)).disposition).toBe('held');
    const adapter = createHeldSlackReplyOperation(selection, s.boundary);
    refused(adapter.invoke({ operation: 'attempt', claim: 'claim', digest: 'hash', message: { account: adapter.describe().account,
      conversation: adapter.describe().conversation, text: 'hello', purpose: 'ordinary-reply' } } as never), 'dispatch is held');
  });
  it('refuses a different selected app or workspace and never sends an ack', () => {
    const s = setup();
    expect(() => prepareSlackIntake({ shared: s.deps, selection: { ...selection, team: 'T99999999' },
      socket: s.socket, boundary: s.boundary, acknowledge: envelope => { s.ack.push(envelope); return s.f.f.success(undefined); } }))
      .toThrow('socket identity differs');
    refused(s.ingress.receive(raw.replace('T12345678', 'T99999999')));
    expect(s.ack).toEqual([]);
  });
  it('holds a non-text message with a durable receipt and no reply operation', () => {
    const s = setup();
    const unsupported = raw.replace('"text":"hello from Slack"', '"files":[{"id":"F12345678"}]');
    expect(value(s.ingress.receive(unsupported)).disposition).toBe('held');
    expect(s.ack).toEqual(['Ev1']);
    expect(value(s.facts.read()).some(f => f.kind === 'intake-held')).toBe(true);
  });
  it('a post timeout stays uncertain and never retries through the client', async () => {
    let calls = 0;
    const client = createSlackApiClient({ owner: 'part-ten', async post() { calls += 1; throw new Error('timeout after invocation'); } },
      { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'slack-fixture' } as never, 1000);
    expect(await client.call('chat.postMessage', { text: 'hello' })).toMatchObject({ ok: false, uncertain: true });
    expect(calls).toBe(1);
    expect(await client.call('chat.postMessage', { text: 'x'.repeat(9000) })).toMatchObject({ error: 'request-too-large' });
    expect(calls).toBe(1);
  });
  it('parses Slack API success, permanent and rate-limit responses without retrying a send', async () => {
    const calls: string[] = [];
    const bodies = [
      { status: 200, headers: {}, body: '{"ok":true,"team_id":"T12345678"}' },
      { status: 200, headers: {}, body: '{"ok":false,"error":"invalid_auth"}' },
      { status: 429, headers: { 'retry-after': '7' }, body: '{"ok":false,"error":"ratelimited"}' },
    ];
    const client = createSlackApiClient({ owner: 'part-ten', async post(input) { calls.push(input.method); return bodies.shift()!; } },
      { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'slack-fixture' } as never, 1000);
    expect(await client.call('auth.test', {})).toMatchObject({ ok: true });
    expect(await client.call('chat.postMessage', {})).toMatchObject({ ok: false, permanent: true });
    expect(await client.call('chat.postMessage', {})).toMatchObject({ ok: false, retryAfter: 7 });
    expect(calls).toHaveLength(3);
  });
});
