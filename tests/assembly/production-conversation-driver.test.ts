import { describe, expect, it } from 'vitest';
import { createConversationStepper, turns, exactTelegramApiAcceptance, runConversationDriver } from '../../src/assembly/production-conversation-driver.js';
import type { ConversationFact, ConversationDriverOperations } from '../../src/assembly/production-conversation-driver.js';
import type { ProductionApplication } from '../../src/assembly/production-application.js';
import { hashBytes } from '../../src/facts/index.js';

const f = (id: string, kind: string, body: Record<string, unknown>): ConversationFact => ({ id, kind, body });
const r = (id: string, kind: string, record: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  f(id, kind, { ...extra, record });
const intake = () => [f('receipt:1', 'intake-receipt', { capture: { reference: 'in:1' } }),
  f('opening:1', 'intake-admitted', { eventId: '1', binding: 'binding', receipt: 'receipt:1' })];
const grounded = () => [r('runfact:1', 'run-opening', { id: 'run:1', opening: { id: 'opening:1' } }, { run: 'run:1' }),
  r('ground:1', 'session-grounding', { run: 'run:1' }),
  r('request:1', 'judgment-provider-ProviderJudgmentRequest', { id: 'request:1', run: 'run:1' })];
const providerEffect = () => r('effect:1', 'effect-provider-ProviderEffectRequest', { id: 'effect:1', run: 'run:1' });
const claim = () => r('claim:1', 'transport-AdmissionReservation',
  { state: 'dispatch-claimed', run: 'run:1', request: 'effect:1' });

describe('production conversation fact fold', () => {
  it('advances monotonically and treats a claimed provider call with no outcome as UNKNOWN', () => {
    const rows = intake();
    expect(turns(rows)[0]?.phase).toBe('admitted');
    rows.push(...grounded());
    expect(turns(rows)[0]?.phase).toBe('grounded');
    rows.push(providerEffect(), claim());
    expect(turns(rows)[0]?.phase).toBe('provider-dispatched-unknown');
    rows.push(r('response:1', 'judgment-provider-ProviderJudgmentAttemptRecord',
      { phase: 'response-observed', request: 'request:1' }));
    expect(turns(rows)[0]?.phase).toBe('provider-dispatched-answered');
    rows.push(r('accepted:1', 'judgment-provider-ProviderAnswerAcceptance',
      { request: 'request:1', capture: { reference: 'answer:1' } }));
    expect(turns(rows)[0]?.phase).toBe('accepted');
    rows.push(r('replyrun:1', 'run-opening', { id: 'reply:1', opening: { id: 'accepted:1' } }, { run: 'reply:1' }));
    rows.push(r('replymessage:1', 'effect-OutboundMessage', { id: 'replymessage:1', purpose: 'ordinary-reply' }),
      r('replyrequest:1', 'effect-EffectRequest', { id: 'replyrequest:1', run: 'reply:1', message: 'replymessage:1' }),
      r('replyclaim:1', 'transport-AdmissionReservation',
        { state: 'dispatch-claimed', run: 'reply:1', request: 'replyrequest:1' }));
    expect(turns(rows)[0]?.phase).toBe('reply-dispatched-unknown');
  });

  it('keeps consumed context delivery grounded until the exact provider request is claimed', () => {
    const rows = [...intake(), ...grounded(),
      r('context-request', 'effect-EffectRequest', { id: 'context-request', run: 'run:1' }),
      r('context-consumed', 'transport-AdmissionReservation',
        { run: 'run:1', request: 'context-request', state: 'consumed' })];
    expect(turns(rows)[0]?.phase).toBe('grounded');
    rows.push(providerEffect(), claim());
    expect(turns(rows)[0]?.phase).toBe('provider-dispatched-unknown');
  });

  it('refuses duplicate admission records for one update', () => {
    expect(() => turns([...intake(), f('opening:other', 'intake-admitted',
      { eventId: '1', binding: 'binding', receipt: 'receipt:1' })])).toThrow('duplicate admitted update');
  });

  it('selects only the installed conversation before a foreign input can open a Run', () => {
    const rows = [...intake(), f('receipt:foreign', 'intake-receipt', { capture: { reference: 'foreign' } }),
      f('opening:foreign', 'intake-admitted', {
        eventId: '2', binding: 'other-conversation', receipt: 'receipt:foreign' })];
    expect(turns(rows, undefined, undefined, 'binding').map(turn => turn.opening)).toEqual(['opening:1']);
  });

  it('requires an exact captured Telegram reply acknowledgement', () => {
    const bytes = JSON.stringify({ ok: true, result: { message_id: 5, chat: { id: 42 }, text: 'reply' } });
    const observation = r('observation', 'effect-OperationObservation',
      { stage: 'response', request: 'request', capture: { reference: 'response', hash: hashBytes(bytes) } });
    const request = r('requestfact', 'effect-EffectRequest', { id: 'request', message: 'message' });
    const facts = [r('messagefact', 'effect-OutboundMessage', { id: 'message', text: 'reply' })];
    const target = { chatId: '42', messageThreadId: null };
    expect(exactTelegramApiAcceptance(observation, request, facts, () => bytes, target)).toBe(true);
    expect(exactTelegramApiAcceptance(observation, request, facts, () => bytes, { ...target, chatId: '43' })).toBe(false);
    expect(exactTelegramApiAcceptance(observation, request, facts, () => bytes + ' ', target)).toBe(false);
  });

  it('accepts the Bot API decoded text of an HTML reply and refuses an escaped echo', () => {
    const escaped = 'PREVIEW\n1 &lt; 2 &amp; ok';
    const facts = [r('messagefact', 'effect-OutboundMessage', { id: 'message', text: escaped })];
    const request = r('requestfact', 'effect-EffectRequest', { id: 'request', message: 'message' });
    const target = { chatId: '42', messageThreadId: null };
    const check = (text: string) => {
      const bytes = JSON.stringify({ ok: true, result: { message_id: 5, chat: { id: 42 }, text } });
      const observation = r('observation', 'effect-OperationObservation',
        { stage: 'response', request: 'request', capture: { reference: 'response', hash: hashBytes(bytes) } });
      return exactTelegramApiAcceptance(observation, request, facts, () => bytes, target);
    };
    expect(check('PREVIEW\n1 < 2 & ok')).toBe(true);
    expect(check(escaped)).toBe(false);
    expect(check('PREVIEW\n1 < 2 & not ok')).toBe(false);
  });
});

function harness() {
  const rows: ConversationFact[] = [...intake(), ...grounded()];
  let stopped = false, now = 0, capacity = true, calls = 0;
  const operations: ConversationDriverOperations = {
    facts: () => rows, pollOnce: () => {}, ground: () => {},
    dispatchProvider: () => { calls++; rows.push(providerEffect(), claim()); },
    acceptAndPrepareReply: () => {}, dispatchReply: () => { calls++; },
    capture: () => 'inbound', apiAccepted: () => false,
    admission: { owner: 'part-six', admitTurn: () => 'admitted', current: () => capacity },
    generation: 'generation', lease: 'lease', expiresAt: 10,
    maxContextTurns: 2, maxContextBytes: 100, replyLimit: 1,
    errorLimit: 1, totalErrorLimit: 2, now: () => now, stopped: () => stopped,
  };
  return { rows, operations, setStop: () => { stopped = true; },
    setExpiry: () => { now = 10; }, setCapacity: () => { capacity = false; }, calls: () => calls };
}

describe('irreversible gates', () => {
  for (const boundary of ['provider', 'reply'] as const) {
    for (const gate of ['stop', 'expiry', 'breaker', 'capacity'] as const) {
      it(`${gate} closes before ${boundary} dispatch`, async () => {
        const h = harness();
        if (boundary === 'reply') {
          h.rows.push(providerEffect(), claim(), r('response:1', 'judgment-provider-ProviderJudgmentAttemptRecord',
            { phase: 'response-observed', request: 'request:1' }),
          r('accepted:1', 'judgment-provider-ProviderAnswerAcceptance',
            { request: 'request:1', capture: { reference: 'answer:1' } }),
          r('replyrun:1', 'run-opening', { id: 'reply:1', opening: { id: 'accepted:1' } }, { run: 'reply:1' }),
          r('replymessage:1', 'effect-OutboundMessage', { id: 'replymessage:1', purpose: 'ordinary-reply' }),
          r('replyrequest:1', 'effect-EffectRequest',
            { id: 'replyrequest:1', run: 'reply:1', message: 'replymessage:1' }));
        }
        if (gate === 'stop') h.setStop();
        if (gate === 'expiry') h.setExpiry();
        if (gate === 'capacity') h.setCapacity();
        if (gate === 'breaker') {
          h.operations.dispatchProvider = () => { throw Error('secret payload'); };
          if (boundary === 'reply') h.operations.dispatchReply = () => { throw Error('secret payload'); };
          const stepper = createConversationStepper(h.operations);
          await expect(stepper.step()).rejects.toThrow();
          expect(await stepper.step()).toBe('stopped');
        } else {
          const result = await createConversationStepper(h.operations).step();
          expect(result).not.toBe('advanced');
        }
        if (gate !== 'breaker') expect(h.calls()).toBe(0);
      });
    }
  }
});

it('reports only fixed-schema diagnostics and stops after the poll breaker', async () => {
  const rows: ConversationFact[] = [];
  const application = { owners: { composition: { spine: { store: {
    readForProjection: () => ({ kind: 'Success', value: { entries: rows.map(fact =>
      ({ fact, taint: [], conflicts: [] })) } }),
  } } } } } as unknown as ProductionApplication;
  const h = harness();
  const diagnostics: unknown[] = [];
  let polls = 0;
  let clock = 0;
  await runConversationDriver(application, {
    ...h.operations, telegramTarget: { chatId: '42', messageThreadId: null },
    maxCycles: 10, baseBackoffMs: 1, maxBackoffMs: 1,
    errorLimit: 2, totalErrorLimit: 3,
    now: () => clock, yieldBoundary: async () => {}, sleep: async ms => { clock += ms; },
    pollOnce: () => { polls++; throw Error('SECRET provider payload'); },
    diagnostic: row => diagnostics.push(row),
  });
  expect(polls).toBe(2);
  expect(diagnostics).toEqual([
    { reason: 'UNKNOWN', phase: 'POLL', consecutiveErrors: 1, totalErrors: 1, backoffMs: 1 },
    { reason: 'UNKNOWN', phase: 'POLL', consecutiveErrors: 2, totalErrors: 2, backoffMs: 0 },
  ]);
  expect(JSON.stringify(diagnostics)).not.toContain('SECRET');
});
