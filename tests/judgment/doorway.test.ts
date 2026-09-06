import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createJudgmentDoorway, createModelAdapter } from '../../src/judgment/index.js';
import type { ProviderObservation } from '../../src/judgment/index.js';
import { judgmentFixture, refused, value } from './fixture.js';

describe('judgment slice real P1/P2/P6 composition', () => {
  it('P7-NF-10 P7-NF-11 P7-NF-12 P7-NF-17 P7-NF-28 records exact question/context/response/meter before exposing one answer', async () => {
    const f = judgmentFixture(), token = f.start();
    const answer = value(await f.door.judge(f.input, token));
    expect(answer.decision.floor?.chosen).toBe('work'); expect(f.calls).toHaveLength(1);
    const facts = value(f.door.inspect());
    expect(facts.map(f => f.record.type)).toEqual(['JudgmentRequest', ...Array(5).fill('JudgmentAttemptRecord'), 'JudgmentResolution']);
    const request = facts[0]!.record; if (request.type !== 'JudgmentRequest') throw new Error('request missing');
    expect(value(f.captures.read(request.submitted))).toBe(f.calls[0]!.bytes);
    const response = facts.find(f => f.record.type === 'JudgmentAttemptRecord' && f.record.phase === 'response-observed')!.record;
    if (response.type !== 'JudgmentAttemptRecord' || !response.receipt) throw new Error('receipt missing');
    expect(JSON.parse(value(f.captures.read(response.receipt)))).toEqual(f.observation);
    const reservations = value(f.six.inspect()).filter(r => r.record.type === 'AdmissionReservation');
    expect(reservations.map(r => r.record.type === 'AdmissionReservation' && [r.record.state, r.record.charge])).toEqual([
      ['prepared', 20], ['dispatch-claimed', 20], ['consumed', 20] ]);
    expect(value(await f.door.judge(f.input, token)).resolution).toEqual(answer.resolution); expect(f.calls).toHaveLength(1);
    expect(consumeResult(value(f.store.readForProjection()).entries.length ? f.door.readAnswer(f.input.id, token) : f.result(() => answer), { Success: () => true, Refused: () => false })).toBe(true);
  });
  it('P7-NF-02 P7-NF-05 P7-NF-07 P7-NF-08 refuses an invented answer/floor/reason without turning it into permission', async () => {
    for (const mutate of [
      (v: Record<string, unknown>) => { delete v.reason; },
      (v: Record<string, unknown>) => { v.approval = true; },
      (v: Record<string, unknown>) => { v.floor = { allowed: { type: 'ActionFloor', schemaVersion: 1, actions: ['other'], default: 'other' }, chosen: 'other' }; },
    ]) {
      const f = judgmentFixture(); const raw = JSON.parse(f.observation.bytes!) as Record<string, unknown>; mutate(raw);
      const bad = judgmentFixture({ observation: { ...f.observation, bytes: JSON.stringify(raw) } });
      refused(await bad.door.judge(bad.input, bad.start()));
      expect(value(bad.door.inspect()).at(-1)?.record).toMatchObject({ type: 'JudgmentResolution', disposition: 'refused' });
      expect(bad.calls).toHaveLength(1);
    }
  });
  it('P7-NF-09 P7-NF-30 a retrying SDK gets zero second invocations after BOTH known rejection and uncertainty', async () => {
    for (const state of ['rejected', 'uncertain'] as const) {
      let retries = 0;
      const observation: ProviderObservation = { state, bytes: null, providerOperation: null,
        usage: { inputTokens: null, outputTokens: null, charge: null, source: 'unknown; retained maximum reservation' }, retryBlocked: false };
      const f = judgmentFixture({ observation, client: { automaticRetries: 0, execute: async (send, options) => {
        expect(options.maxRetries).toBe(0); await send(); retries++; await send();
      } } });
      refused(await f.door.judge(f.input, f.start()), 'no usable answer'); expect(retries).toBe(1); expect(f.calls).toHaveLength(1);
      const row = value(f.door.inspect()).find(v => v.record.type === 'JudgmentAttemptRecord' && v.record.receipt)?.record;
      if (row?.type !== 'JudgmentAttemptRecord' || !row.receipt) throw new Error('missing receipt');
      expect(JSON.parse(value(f.captures.read(row.receipt)))).toMatchObject({ retryBlocked: true, state, usage: { charge: null } });
      expect(value(f.six.inspect()).at(-1)?.record).toMatchObject({ type: 'AdmissionReservation', state: 'consumed', charge: 20 });
    }
  });
  it('P7-NF-09 rejects a client whose automatic retries cannot be disabled; no-call SDK cannot fake a receipt', async () => {
    const f = judgmentFixture();
    refused(createModelAdapter(f.host.description, { automaticRetries: 1, execute: async () => {} }, async () => f.observation, f.six, f.host.transport, f.c), 'retries must be disabled');
    const noop = judgmentFixture({ client: { automaticRetries: 0, execute: async () => {} } });
    refused(await noop.door.judge(noop.input, noop.start()), 'no admitted provider observation'); expect(noop.calls).toHaveLength(0);
  });
  it('P7-NF-14 P7-NF-22 capture/append failure after provider return makes answer unusable and cannot repeat the call', async () => {
    let fail = true;
    const f = judgmentFixture({ storage: base => ({ ...base, append: (bytes, head) => {
      if (fail && bytes.includes('response-observed')) return f.result(() => { throw new Error('disk fault at provider receipt'); });
      return base.append(bytes, head);
    } }) });
    const token = f.start(); refused(await f.door.judge(f.input, token), 'disk fault'); expect(f.calls).toHaveLength(1);
    fail = false;
    refused(await createJudgmentDoorway(f.ports).judge(f.input, token), 'missing receipt'); expect(f.calls).toHaveLength(1);
    refused(f.door.readAnswer(f.input.id, token), 'resolution receipt missing');
  });
  it('P7-NF-15 resumes receipt-to-resolution after append failure without calling provider again', async () => {
    let fail = true;
    const f = judgmentFixture({ storage: base => ({ ...base, append: (bytes, head) => {
      if (fail && bytes.includes('accounting-observed')) return f.result(() => { throw new Error('accounting append fault'); });
      return base.append(bytes, head);
    } }) });
    const token = f.start(); refused(await f.door.judge(f.input, token), 'accounting append fault'); fail = false;
    expect(value(await createJudgmentDoorway(f.ports).judge(f.input, token)).decision.floor?.chosen).toBe('work'); expect(f.calls).toHaveLength(1);
  });
  it('P7-NF-16 P7-NF-19 stop and expiry retain late observations but never release a usable answer', async () => {
    for (const stop of [true, false]) {
      const f = judgmentFixture({ invoke: async () => { if (stop) f.stop(); else f.time(500); return f.observation; } });
      refused(await f.door.judge(f.input, f.start()), stop ? 'stop' : 'deadline');
      expect(value(f.door.inspect()).at(-1)?.record.type).toBe('JudgmentResolution'); expect(f.calls).toHaveLength(1);
    }
  });
  it('P7-NF-17 changed input under one question refuses and overlapping calls cannot double dispatch', async () => {
    let finish!: () => void;
    const blocked = new Promise<void>(r => { finish = r; });
    const f = judgmentFixture({ invoke: async () => { await blocked; return f.observation; } }), token = f.start();
    const first = f.door.judge(f.input, token);
    refused(await createJudgmentDoorway(f.ports).judge(f.input, token), 'unresolved dispatch');
    refused(await f.door.judge({ ...f.input, question: 'changed' }, token), 'collision');
    finish(); value(await first); expect(f.calls).toHaveLength(1);
  });
});
