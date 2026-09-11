import { expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import {
  createTelegramIngress, createTelegramIntakeAdapter, extractTelegramUpdate,
} from '../../src/conversation/index.js';
import { conversationFixture, telegramRaw } from './fixture.js';
import { value } from '../intake/fixtures.js';

function installIntake(f: ReturnType<typeof conversationFixture>) {
  const telegram = createTelegramIntakeAdapter(f.admitted, f.api);
  Object.assign(f.intake.deps, {
    adapter: {
      id: telegram.id,
      authenticate(raw: string, route: Parameters<typeof telegram.authenticate>[1], at: Parameters<typeof telegram.authenticate>[2]) {
        f.intake.trace.push('telegram-authenticate'); return telegram.authenticate(raw, route, at);
      },
      parse(raw: string) { f.intake.trace.push('telegram-parse'); return telegram.parse(raw); },
    },
    governance: f.governed.governance,
  });
  const intake = value(createIntakePort(f.intake.deps));
  const facts = createFactStore(f.intake.context, f.intake.storage);
  const ingress = createTelegramIngress({
    boundary: f.admissionDependencies.boundary, admitted: f.admitted, api: f.api,
    intake, facts, observer: f.intake.deps.author.principal.id,
  });
  return { intake, facts, ingress };
}

it('P12-NF-03 P12-NF-05 P12-NF-06 P12-NF-08 P12-NF-10 captured reply enters the public Part Four order and is admitted only by owner facts', () => {
  const f = conversationFixture();
  const raw = telegramRaw('reply');
  const route = extractTelegramUpdate(raw, f.declaration).route;
  f.bind(route);
  f.intake.trace.splice(0);
  const { ingress, facts } = installIntake(f);
  f.queue(raw);
  const cycle = value(ingress.pollOnce());
  expect(cycle).toMatchObject({ requestedOffset: 0, committedThrough: 100, nextOffset: 101, blockedOnUpdate: null });
  expect(cycle.captured).toHaveLength(1);
  expect(cycle.captured[0]).toMatchObject({ updateId: 100, kind: 'reply', custody: 'durable', intake: 'admitted' });
  const kinds = value(facts.read()).map(fact => fact.kind);
  expect(kinds).toContain('intake-receipt');
  expect(kinds).toContain('intake-admitted');
  const capture = f.intake.trace.indexOf('capture');
  const receipt = f.intake.trace.indexOf('append:intake-receipt');
  const authenticate = f.intake.trace.indexOf('telegram-authenticate');
  const parse = f.intake.trace.indexOf('telegram-parse');
  const admitted = f.intake.trace.indexOf('append:intake-admitted');
  expect([capture, receipt, authenticate, parse, admitted].every(index => index >= 0)).toBe(true);
  expect(capture).toBeLessThan(receipt);
  expect(receipt).toBeLessThan(authenticate);
  expect(authenticate).toBeLessThan(parse);
  expect(parse).toBeLessThan(admitted);
});

it('P12-NF-11 P12-NF-13 P12-NF-17 P12-NF-51 every update kind gains durable custody and an explicit admitted-or-owned disposition', () => {
  const f = conversationFixture();
  const { ingress, facts } = installIntake(f);
  f.queue(...f.fixtureNames.map(telegramRaw));
  const cycle = value(ingress.pollOnce());
  expect(cycle.captured.map(row => row.kind)).toEqual([
    'reply', 'callback', 'edit', 'channel-post', 'service-event', 'media-metadata', 'unsupported',
  ]);
  expect(cycle.captured.every(row => row.custody === 'durable'
    && ['admitted', 'duplicate', 'stopped', 'stop-signal', 'owned-refusal'].includes(row.intake))).toBe(true);
  expect(cycle.captured.find(row => row.kind === 'media-metadata')).toMatchObject({ intake: 'owned-refusal' });
  expect(f.calls.send).toHaveLength(0);
  expect(value(facts.read()).filter(fact => fact.kind === 'intake-receipt')).toHaveLength(7);
  expect(cycle.nextOffset).toBe(107);
});

it('P12-NF-06 P12-NF-12 P12-NF-18 offset stops before an update without a Part Four receipt and restart derives the same cursor from facts', () => {
  const f = conversationFixture();
  const reply = telegramRaw('reply'), callback = telegramRaw('callback');
  const route = extractTelegramUpdate(reply, f.declaration).route;
  f.bind(route);
  const physicalCapture = f.intake.deps.capture;
  Object.assign(f.intake.deps, { capture: {
    owner: 'part-ten' as const,
    preserve(raw: string, at: Parameters<typeof physicalCapture.preserve>[1]) {
      if (raw.includes('"update_id": 101')) throw new Error('injected capture loss before receipt');
      return physicalCapture.preserve(raw, at);
    },
  } });
  const { ingress, facts, intake } = installIntake(f);
  f.queue(reply, callback);
  const cycle = value(ingress.pollOnce());
  expect(cycle).toMatchObject({ committedThrough: 100, nextOffset: 101, blockedOnUpdate: 101 });
  expect(cycle.captured.map(row => row.updateId)).toEqual([100]);
  expect(value(facts.read()).filter(fact => fact.kind === 'intake-receipt')).toHaveLength(1);

  const restarted = createTelegramIngress({
    boundary: f.admissionDependencies.boundary, admitted: f.admitted, api: f.api,
    intake, facts: createFactStore(f.intake.context, f.intake.storage), observer: f.intake.deps.author.principal.id,
  });
  expect(value(restarted.currentOffset())).toBe(101);
});

it('P12-NF-06 P12-NF-11 P12-NF-18 webhook success exists only after the exact update has a durable Part Four receipt', () => {
  const f = conversationFixture({ mode: 'webhook', botId: '9010' });
  const { ingress, facts } = installIntake(f);
  const raw = telegramRaw('callback');
  const outcome = value(ingress.receiveWebhook(raw));
  expect(outcome).toMatchObject({ protocolAcknowledgment: 'success', captured: { updateId: 101, custody: 'durable' } });
  expect(value(facts.read()).some(fact => fact.id === outcome.captured.receipt && fact.kind === 'intake-receipt')).toBe(true);
});
