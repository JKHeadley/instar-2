import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend, hashBytes } from '../../src/facts/index.js';
import { admitTelegramAdapter, extractTelegramUpdate } from '../../src/conversation/index.js';
import { privateKey } from '../facts/fixtures.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramOutbound, telegramUpdate, wireTelegram } from './round3-fixture.js';

const asJson = (input: unknown) => JSON.parse(value(canonical(input)).bytes);

it('P12-NF-28 round3 a consumed claim cannot directly replay after its one witnessed invocation', () => {
  const f = telegramOutbound();
  const observation = value(f.doorway.dispatch(f.request, f.effects.fence));
  expect(f.telegram.calls.send).toHaveLength(1);
  const replay = f.adapter.invoke({ operation: observation.operation, claim: observation.claim,
    digest: f.request.digest, message: f.message });
  expect(replay.kind).toBe('Refused');
  expect(f.telegram.calls.send).toHaveLength(1);
});

it('P12-NF-28 round3 a consumed claim without durable executor acceptance cannot invoke', () => {
  const f = telegramOutbound();
  const reservation = value(f.effects.transport.inspect())
    .filter(row => row.record.type === 'AdmissionReservation').at(-1)!.record;
  if (reservation.type !== 'AdmissionReservation') throw new Error('reservation missing');
  const capability = value(f.effects.transport.claim('round3-unwitnessed-claim', f.effects.fence, reservation.operation));
  const claim = value(f.effects.transport.inspect()).find(row => row.record.type === 'AdmissionReservation'
    && row.record.operation === reservation.operation && row.record.state === 'dispatch-claimed')!.fact.id;
  value(f.effects.transport.consume(capability, f.effects.fence));
  const invoked = f.adapter.invoke({ operation: reservation.operation, claim,
    digest: f.request.digest, message: f.message });
  expect(invoked.kind).toBe('Refused');
  expect(f.telegram.calls.send).toHaveLength(0);
  expect(value(f.effects.spine.store.read()).filter(row => row.kind === 'effect-OperationObservation')).toHaveLength(0);
});

it('P12-NF-06 P12-NF-16 P12-NF-18 P12-NF-38 round3 cursor projection ignores receipts with a changed bot epoch or raw hash', () => {
  for (const variant of ['epoch', 'rawHash'] as const) {
    const f = conversationFixture({ initialOffset: 100 });
    const wire = wireTelegram(f);
    f.queue(telegramUpdate(100));
    value(wire.ingress.pollOnce());
    const original = value(wire.facts.read()).find(row => row.kind === 'intake-receipt')!;
    const route = JSON.parse(String((original.body as any).ingress));
    route.eventId = '101';
    if (variant === 'epoch') route.identityEpoch = 'telegram:v1:bot:9001:epoch:another';
    const body = { ...(original.body as Record<string, unknown>), ingress: value(canonical(route)).bytes } as any;
    if (variant === 'rawHash') body.rawHash = hashBytes('not captured');
    value(authorAndAppend({ kind: 'intake-receipt', schemaVersion: 1,
      machine: f.intake.deps.author.machine, principal: asJson(f.intake.deps.author.principal),
      provenance: asJson(f.intake.deps.author.provenance), at: asJson(f.intake.f.clock(100)),
      body, required: [original.id] }, f.intake.context, wire.facts, privateKey));
    expect(value(wire.ingress.currentOffset())).toBe(101);
  }
});

it('P12-NF-06 P12-NF-12 P12-NF-13 P12-NF-17 round3 routable unsupported and oversized updates retain receipts and owned dispositions', () => {
  const unsupported = conversationFixture();
  const unsupportedWire = wireTelegram(unsupported);
  unsupported.queue(JSON.stringify({ update_id: 100,
    chat_boost: { chat: { id: -1001, type: 'supergroup' }, boost: { boost_id: 'b' } } }));
  const unsupportedCycle = value(unsupportedWire.ingress.pollOnce());
  expect(unsupportedCycle.captured[0]).toMatchObject({ updateId: 100, kind: 'unsupported', intake: 'owned-refusal' });
  expect(value(unsupportedWire.facts.read()).filter(row => row.kind === 'intake-receipt')).toHaveLength(1);

  const oversized = conversationFixture();
  const oversizedWire = wireTelegram(oversized);
  const raw = telegramUpdate(100, update => { update.message.text = 'x'.repeat(65_536); });
  expect(raw.length).toBeGreaterThan(oversized.declaration.limits.maxUpdateBytes);
  oversized.queue(raw);
  const oversizedCycle = value(oversizedWire.ingress.pollOnce());
  expect(oversizedCycle.captured[0]).toMatchObject({ updateId: 100, intake: 'owned-refusal', custody: 'durable' });
  const facts = value(oversizedWire.facts.read());
  const receipt = facts.find(row => row.kind === 'intake-receipt')!;
  expect(receipt.body).toMatchObject({ rawHash: hashBytes(raw), adapter: 'telegram-intake-v1' });
  expect(facts.some(row => row.kind === 'intake-held')).toBe(true);
  expect(oversized.calls.authenticate).toHaveLength(0);
  expect(oversizedCycle.nextOffset).toBe(101);
});

it('P12-NF-04 P12-NF-18 round3 two ingress handles share the admitted bot single-poll bound', () => {
  const f = conversationFixture();
  let active = 0;
  let maximum = 0;
  let nested: ReturnType<typeof f.intake.f.success> | undefined;
  let second: ReturnType<typeof wireTelegram>;
  const api = { ...f.api,
    poll(input: Parameters<typeof f.api.poll>[0]) {
      active += 1;
      maximum = Math.max(maximum, active);
      if (active === 1) nested = second.ingress.pollOnce() as typeof nested;
      const result = f.api.poll(input);
      active -= 1;
      return result;
    },
  };
  const admitted = value(admitTelegramAdapter(f.declaration, { ...f.admissionDependencies, api }));
  const shared = { ...f, api, admitted } as ReturnType<typeof conversationFixture>;
  const first = wireTelegram(shared);
  second = wireTelegram(shared);
  const outer = first.ingress.pollOnce();
  expect(outer.kind).toBe('Success');
  expect(nested?.kind).toBe('Refused');
  expect(maximum).toBe(1);
});

it('P12-NF-07 P12-NF-08 P12-NF-17 round3 sender-less edited channel reaches Part Four custody without becoming a person', () => {
  const f = conversationFixture();
  const wire = wireTelegram(f);
  const raw = telegramUpdate(100, update => {
    update.message.sender_chat = { id: -200, type: 'channel' };
    delete update.message.from;
    update.edited_message = update.message;
    delete update.message;
  });
  expect(extractTelegramUpdate(raw, f.declaration).principal.kind).toBe('system');
  f.queue(raw);
  expect(value(wire.ingress.pollOnce()).captured[0]).toMatchObject({ kind: 'edit', intake: 'owned-refusal' });
  expect(value(wire.facts.read()).filter(row => row.kind === 'intake-receipt')).toHaveLength(1);
  expect(value(wire.facts.read()).some(row => row.kind === 'intake-admitted')).toBe(false);
});
