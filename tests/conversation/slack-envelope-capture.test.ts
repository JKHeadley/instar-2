import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { prepareSlackIntake } from '../../src/assembly/production-slack.js';
import { createSlackIntakeAdapter, extractSlackEnvelope, slackParserDeclarationId } from '../../src/conversation/slack.js';
import type { SlackSelection } from '../../src/conversation/slack.js';
import { intakeFixture, value } from '../intake/fixtures.js';

// Rule 36: the Slack envelope reader runs on a genuine Socket Mode events_api envelope (slack-envelope.json),
// received 2026-11-08T01:51:27Z on a capture-only connection of the test app, for a DM a person's account sent;
// ids digit-masked to the same length and the verification token replaced; see tests/fixtures/captures/README.md.
const captured = readFileSync(new URL('../fixtures/captures/slack-envelope.json', import.meta.url), 'utf8');
const selection: SlackSelection = { app: 'A0000000001', team: 'T0000000001', bot: 'B0000000001',
  operator: 'U0000000001', principal: 'alice', channel: 'D0000000001', thread: null, epoch: 'socket:1' };

function setup() {
  const f = intakeFixture({});
  const parser = (JSON.parse(readFileSync('src/conversation/slack.parser.json', 'utf8')) as object[])
    .map(declaration => ({ ...declaration, status: 'live' }));
  Object.assign(f.r.context, { references: [...f.r.context.references ?? [],
    { provider: 'fixture', id: 'P12-SLACK-EVENT-CAPTURE', kind: 'captured-bytes' },
    { provider: 'fixture', id: 'P12-SLACK-EVENT-ON-CAPTURE' },
    { provider: 'fixture', id: 'P12-NF-19' }, { provider: 'fixture', id: 'P12-NF-28' }] });
  const features = JSON.parse(readFileSync('src/conversation/slack.declarations.json', 'utf8')) as object[];
  const governed = f.govern([...f.registerInput.sources.map(source => source.declaration), ...parser, ...features]);
  Object.assign(f.context, { decode: { ...f.context.decode, register: { ...f.context.decode.register,
    entries: [...f.context.decode.register.entries, slackParserDeclarationId],
    methods: [...f.context.decode.register.methods, 'telegram-sender'] } } });
  const route = extractSlackEnvelope(captured, selection).route;
  f.bind({ adapter: slackParserDeclarationId, channel: route.channel, sender: route.sender,
    identityEpoch: route.identityEpoch, principalId: 'alice' });
  const proof = f.f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity', true);
  f.syncCaptures();
  const socket = { owner: 'part-ten' as const, app: selection.app, team: selection.team, bot: selection.bot,
    incarnation: 'socket:1', currentIncarnation: () => 'socket:1',
    authenticate: () => f.f.success({ ...proof.input, adapter: slackParserDeclarationId, evidence: { kind: 'channel' as const, authenticated: true } }),
    readCapture: (reference: string) => f.f.success(f.f.captures[reference] ?? '') };
  const boundary = { site: 'intake.admit', preserved: f.context.preserved, register: f.context.decode.register };
  const ack: string[] = [];
  const prepared = prepareSlackIntake({ shared: { ...f.deps, governance: governed.governance }, selection, socket, boundary,
    acknowledge: envelope => { ack.push(envelope); return f.f.success(undefined); } });
  if ('kind' in prepared) throw new Error(prepared.detail);
  return { ingress: prepared.ingress, facts: createFactStore(f.context, f.storage), ack, socket, boundary };
}

describe('P12-SLACK-EVENT-ON-CAPTURE Slack envelope reader on the genuine capture', () => {
  it('reads the genuine DM envelope as a person message routed by the Slack event_id', () => {
    const extracted = extractSlackEnvelope(captured, selection);
    expect(extracted).toMatchObject({ envelopeId: '00000000-0000-0000-0000-000000000001', eventId: 'Ev0000000001' });
    expect(extracted.route).toEqual({ channel: 'slack:v1:A0000000001:T0000000001:D0000000001:dm',
      sender: 'U0000000001', identityEpoch: 'socket:1', eventId: 'Ev0000000001' });
    // What the genuine bytes show: Slack adds team, blocks and channel_type to an ordinary DM event, which are
    // outside the reader's text slice, so the reader holds the text instead of reading it.
    expect(Object.keys(JSON.parse(captured).payload.event)).toEqual(
      ['type', 'user', 'ts', 'text', 'team', 'blocks', 'channel', 'event_ts', 'channel_type']);
    expect(extracted.text).toBeNull();
  });

  it('takes durable custody of the genuine bytes before ack and holds them, admitting nothing', () => {
    const s = setup();
    expect(value(s.ingress.receive(captured)).disposition).toBe('held');
    expect(s.ack).toEqual(['00000000-0000-0000-0000-000000000001']);
    // A Socket Mode redelivery of the same bytes is held again and acked again; it is never admitted.
    expect(value(s.ingress.receive(captured)).disposition).toBe('held');
    expect(s.ack).toEqual(['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001']);
    const kinds = value(s.facts.read()).map(x => x.kind);
    expect(kinds.filter(kind => kind === 'intake-receipt')).toHaveLength(2);
    expect(kinds.filter(kind => kind === 'intake-held')).toHaveLength(2);
    expect(kinds).not.toContain('intake-admitted');
  });

  it('refuses the genuine shape from another workspace, from a bot, or as an edit', () => {
    const envelope = JSON.parse(captured);
    expect(() => extractSlackEnvelope(captured, { ...selection, team: 'T0000000009' })).toThrow(/app or workspace/u);
    const bot = structuredClone(envelope); bot.payload.event.bot_id = 'B0000000001';
    expect(() => extractSlackEnvelope(JSON.stringify(bot), selection)).toThrow(/bot and edited/u);
    const edited = structuredClone(envelope); edited.payload.event.subtype = 'message_changed';
    expect(() => extractSlackEnvelope(JSON.stringify(edited), selection)).toThrow(/bot and edited/u);
    const s = setup();
    expect(createSlackIntakeAdapter(selection, s.socket, s.boundary as never).parse(captured))
      .toEqual({ schemaVersion: 1, kind: 'held-slack-event' });
  });
});
