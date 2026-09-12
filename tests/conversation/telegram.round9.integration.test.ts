import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { dryRunLegacyConversationMigration } from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramUnpreparedOutbound } from './round5-fixture.js';
import { telegramUpdate, wireTelegram } from './round3-fixture.js';

function runInbound(raw: string, accepted: boolean): void {
  const f = conversationFixture({ initialOffset: 100 });
  const wired = wireTelegram(f);
  f.queue(raw);
  expect(wired.ingress.pollOnce().kind).toBe(accepted ? 'Success' : 'Refused');
  expect(value(wired.facts.read()).filter(row => row.kind === 'intake-receipt')).toHaveLength(accepted ? 1 : 0);
  expect(value(wired.ingress.currentOffset())).toBe(accepted ? 101 : 100);
}

function sourceUpdate(source: 'sender_chat' | 'actor_chat', chat: { readonly id: number; readonly type: string }): string {
  return telegramUpdate(100, update => {
    if (source === 'sender_chat') {
      update.message.sender_chat = chat; delete update.message.from;
      return;
    }
    update.message_reaction = { chat: update.message.chat, message_id: 700, actor_chat: chat,
      date: 1_700_000_000, old_reaction: [], new_reaction: [] };
    delete update.message;
  });
}

function channelPostUpdate(variant: 'channel_post' | 'edited_channel_post',
  chat: { readonly id: number; readonly type: string }, explicitSource: boolean): string {
  return telegramUpdate(100, update => {
    update[variant] = { ...update.message, chat };
    delete update[variant].message_thread_id;
    delete update.message;
    if (explicitSource) update[variant].sender_chat = { id: -1000000001001, type: 'channel' };
  });
}

it('P12-NF-07 P12-NF-16 P12-NF-17 P12-NF-18 round9 finding 1 refuses all reviewer source id/type mismatches before custody', () => {
  for (const chat of [
    { id: -1000000000123, type: 'group' },
    { id: -123, type: 'supergroup' },
    { id: -123, type: 'channel' },
  ] as const) for (const source of ['sender_chat', 'actor_chat'] as const) runInbound(sourceUpdate(source, chat), false);

  for (const chat of [
    { id: -123, type: 'group' },
    { id: -1000000000123, type: 'supergroup' },
    { id: -1000000000123, type: 'channel' },
  ] as const) for (const source of ['sender_chat', 'actor_chat'] as const) runInbound(sourceUpdate(source, chat), true);
}, 30_000);

it('P12-NF-16 P12-NF-17 P12-NF-18 round9 finding 2 refuses channel variants with non-channel destinations despite explicit sender', () => {
  for (const variant of ['channel_post', 'edited_channel_post'] as const) {
    for (const chat of [{ id: -123, type: 'group' }, { id: 123, type: 'private' }] as const)
      runInbound(channelPostUpdate(variant, chat, true), false);
    for (const explicitSource of [false, true])
      runInbound(channelPostUpdate(variant, { id: -1000000001001, type: 'channel' }, explicitSource), true);
  }
});

it('P12-NF-29 P12-NF-30 round9 finding 3 registered dispatch refuses renderer-invalid text with zero provider calls', () => {
  for (const [name, text, accepted] of [
    ['plain', 'Hello', true],
    ['escaped', 'A &lt; B &amp; C', true],
    ['null-control', 'bad\u0000text', false],
    ['other-control', 'bad\u0001text', false],
  ] as const) {
    const f = telegramUnpreparedOutbound(false, text);
    const before = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation');
    const prepared = f.prepare();
    if (accepted) {
      expect(value(f.doorway.dispatch(value(prepared), f.effects.fence)).stage, name).toBe('response');
      expect(f.telegram.calls.send, name).toHaveLength(1);
    } else {
      expect(prepared.kind, name).toBe('Refused');
      if (prepared.kind === 'Refused') expect(prepared.detail, name).toContain('unsupported control data');
      expect(value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'), name)
        .toEqual(before);
      expect(f.telegram.calls.send, name).toHaveLength(0);
    }
  }
}, 30_000);

it('P12-NF-52 round9 finding 4 dry run is a real read-only consumer over the legacy journal fixture', () => {
  const f = conversationFixture();
  const source = readFileSync('tests/conversation/fixtures/legacy/conversation-registry-send-intent.jsonl', 'utf8');
  const intakeBefore = f.intake.facts().map(row => row.id);
  const assemblyBefore = value(f.assembly.store.readForProjection()).entries.map(row => row.fact.id);
  const report = value(dryRunLegacyConversationMigration({ source, maxBytes: 4096, maxRecords: 4 },
    f.admissionDependencies.boundary));
  expect(report.records.map(row => [row.operation, row.disposition, row.replayPermitted]))
    .toEqual([['send-intent', 'unmappable', false]]);
  expect(report.records[0]!.raw).toBe(source.trim());
  expect(report.providerCalls).toBe(0);
  expect(f.calls.send).toHaveLength(0);
  expect(f.intake.facts().map(row => row.id)).toEqual(intakeBefore);
  expect(value(f.assembly.store.readForProjection()).entries.map(row => row.fact.id)).toEqual(assemblyBefore);
});
