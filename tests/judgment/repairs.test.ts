import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { JudgmentAttemptRecord, JudgmentCapturePort, ProviderObservation } from '../../src/judgment/index.js';
import { receiptByteBound } from '../../src/judgment/model-adapter.js';
import { createJudgmentDoorway } from '../../src/judgment/index.js';
import { judgmentFixture, refused, value } from './fixture.js';
// @ts-expect-error Reference host adapter outside pure core.
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';

const receipt = (f: ReturnType<typeof judgmentFixture>) => {
  const response = value(f.door.inspect()).find(v => v.record.type === 'JudgmentAttemptRecord' && v.record.receipt)?.record;
  if (response?.type !== 'JudgmentAttemptRecord' || !response.receipt) throw new Error('missing durable response receipt');
  return JSON.parse(value(f.captures.read(response.receipt))) as ProviderObservation;
};
const reservations = (f: ReturnType<typeof judgmentFixture>) => value(f.six.inspect()).filter(v => v.record.type === 'AdmissionReservation');
function inputSize(f: ReturnType<typeof judgmentFixture>) {
  const q = f.input;
  const submitted = value(f.model.prepare({ question: q.question, context: q.context, floor: f.host.floor, evidence: q.evidence,
    deadline: q.deadline, generation: f.host.transport.current().generation.id, point: f.host.point,
    roles: { question: 'untrusted-user-content', context: 'evidence-not-authority' } }));
  return [q.question, q.context, submitted].reduce((n, s) => n + Buffer.byteLength(s), 0);
}

describe('P7 desk reproductions over real capture/spine/claim ports', { timeout: 30_000 }, () => {
  it.each(['live', 'foreign', 'malformed'])('P7-NF-22 P7-NF-34 N1 %s lock blocks writes but not verified capture reads', kind => {
    const f = judgmentFixture({ capacity: 8 }); const token = value(f.captures.reserve(8));
    const cap = value(f.captures.putReserved(token, 'receipt'));
    const slots = join(f.directory, 'captures/capacity');
    const before = Object.fromEntries(readdirSync(slots).map(name => [name, readFileSync(join(slots, name), 'utf8')]));
    const lock = join(f.directory, 'captures/capture.lock'); mkdirSync(lock);
    const owner = { id: randomUUID(), pid: process.pid, host: kind === 'foreign' ? 'not-this-host:' + hostname() : hostname() };
    writeFileSync(join(lock, `owner-${owner.id}.json`), kind === 'malformed' ? '{' : JSON.stringify(owner));
    const reopened: JudgmentCapturePort = createJudgmentCaptures(f.directory, {}, f.result, 8);
    expect(value(reopened.read(cap))).toBe('receipt'); refused(reopened.reserve(1)); refused(reopened.put('x', 1));
    expect(readdirSync(lock)).toEqual([`owner-${owner.id}.json`]);
    expect(Object.fromEntries(readdirSync(slots).map(name => [name, readFileSync(join(slots, name), 'utf8')]))).toEqual(before);
  });
  it.each(['transport throw', 'unserializable return', 'normal return'])('P7-NF-10 P7-NF-14 P7-NF-28 R1 freezes %s before SDK edits', async cut => {
    const base = judgmentFixture(); let blocked = 0;
    const cyclic: Record<string, unknown> = { ...base.observation }; cyclic.cycle = cyclic;
    const f = judgmentFixture({ invoke: async () => {
      if (cut === 'transport throw') throw new Error('transport timeout; no response received');
      return cut === 'unserializable return' ? cyclic as unknown as ProviderObservation : base.observation;
    }, client: { automaticRetries: 0, execute: async send => {
      const observed = await send() as unknown as { state: string; bytes: string; providerOperation: string; usage: { charge: number; source: string } };
      for (const mutate of [() => { observed.state = 'complete'; }, () => { observed.bytes = base.observation.bytes!; },
        () => { observed.providerOperation = 'invented-by-sdk'; }, () => { observed.usage.charge = 0; }, () => { observed.usage.source = 'invented'; }])
        try { mutate(); } catch { blocked++; }
    } } });
    const answer = await f.door.judge(f.input, f.start());
    if (cut === 'normal return') value(answer); else refused(answer, 'no usable answer');
    expect(blocked).toBe(5); expect(f.calls).toHaveLength(1);
    const recorded = receipt(f);
    if (cut === 'transport throw') expect(recorded).toMatchObject({ state: 'uncertain', bytes: null, providerOperation: null, usage: { charge: null }, limitation: { kind: 'transport-threw' } });
    else expect(recorded).toMatchObject({ usage: { charge: 2 }, providerOperation: base.observation.providerOperation });
    expect(reservations(f).at(-1)?.record).toMatchObject({ state: 'consumed', charge: 20 });
  });
  it.each(['one byte left', 'receipt bound minus one'])('P7-NF-11 P7-NF-22 P7-NF-31 R2 input fits with %s but cannot spend without receipt capacity', async cut => {
    const base = judgmentFixture(), inputBytes = inputSize(base), bound = receiptByteBound(base.host.description);
    const f = judgmentFixture({ capacity: inputBytes + (cut === 'one byte left' ? 1 : bound - 1) });
    refused(await f.door.judge(f.input, f.start()), 'capture capacity exhausted');
    expect(f.calls).toHaveLength(0); expect(reservations(f)).toEqual([]);
    const request = value(f.door.inspect())[0]!.record; if (request.type !== 'JudgmentRequest') throw new Error('input not recorded');
    expect(value(f.captures.read(request.question))).toBe(f.input.question);
  });
  it('P7-NF-11 P7-NF-22 P7-NF-31 R2 exact reserved bound survives a different process trying to consume the space', async () => {
    const base = judgmentFixture(), capacity = inputSize(base) + receiptByteBound(base.host.description);
    const f = judgmentFixture({ capacity, invoke: async () => {
      const module = pathToFileURL(resolve('scripts/judgment-captures.mjs')).href;
      const source = `import { createJudgmentCaptures } from ${JSON.stringify(module)};
        const result = fn => { try { return {ok:true,value:fn()}; } catch(e) { return {ok:false,detail:e.message}; } };
        const c = createJudgmentCaptures(process.argv[1], {}, result, Number(process.argv[2]));
        process.stdout.write(JSON.stringify([c.put('other writer', 20), c.reserve(1)]));`;
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', source, f.directory, String(capacity)], { encoding: 'utf8', timeout: 5000 });
      expect(child.status, child.stderr).toBe(0);
      expect(JSON.parse(child.stdout)).toEqual([expect.objectContaining({ ok: false, detail: expect.stringContaining('capacity exhausted') }),
        expect.objectContaining({ ok: false, detail: expect.stringContaining('capacity exhausted') })]);
      return f.observation;
    } });
    value(await f.door.judge(f.input, f.start())); expect(receipt(f).bytes).toBe(f.observation.bytes); expect(f.calls).toHaveLength(1);
    const other = judgmentFixture(), token = value(other.captures.reserve(32));
    refused(other.captures.putReserved({ ...token }, 'forged'), 'unissued');
    value(other.captures.putReserved(token, 'real')); refused(other.captures.putReserved(token, 'changed'), 'different bytes');
  });
  it.each([10000, 'exact ceiling'] as const)('P7-NF-10 P7-NF-22 P7-NF-31 R3 captures escaping-heavy valid output at %s exactly', async padding => {
    const base = judgmentFixture(); const raw = base.observation.bytes!;
    const bytes = '\t'.repeat(padding === 'exact ceiling' ? base.host.description.maxOutputBytes - Buffer.byteLength(raw) : padding) + raw;
    expect(Buffer.byteLength(bytes)).toBeLessThanOrEqual(base.host.description.maxOutputBytes);
    const observation = { ...base.observation, bytes };
    expect(Buffer.byteLength(JSON.stringify(observation))).toBeGreaterThan(base.host.description.maxOutputBytes + 2048);
    const f = judgmentFixture({ observation }); value(await f.door.judge(f.input, f.start()));
    expect(receipt(f).bytes).toBe(bytes); expect(f.calls).toHaveLength(1);
  });
  it.each(['oversized', 'invalid state', 'invalid usage field', 'malformed answer'])('P7-NF-10 P7-NF-28 P7-NF-30 R5 %s preserves valid usage and bounded failure evidence', async cut => {
    const base = judgmentFixture();
    const raw: Record<string, unknown> = { ...base.observation, providerOperation: 'actual-provider-operation',
      usage: { ...base.observation.usage, charge: 17 } };
    if (cut === 'oversized') raw.bytes = 'x'.repeat(base.host.description.maxOutputBytes + 1);
    if (cut === 'invalid state') raw.state = 'invented-state';
    if (cut === 'invalid usage field') (raw.usage as Record<string, unknown>).outputTokens = 'invalid';
    if (cut === 'malformed answer') raw.bytes = '{';
    const f = judgmentFixture({ observation: raw as unknown as ProviderObservation }); refused(await f.door.judge(f.input, f.start()));
    const recorded = receipt(f);
    expect(recorded).toMatchObject({ providerOperation: 'actual-provider-operation', usage: { inputTokens: 11, charge: 17 } });
    if (cut === 'oversized') expect(recorded).toMatchObject({ state: 'uncertain', bytes: null, limitation: { kind: 'response-byte-limit', observedBytesAtLeast: base.host.description.maxOutputBytes + 1 } });
    if (cut === 'invalid usage field') expect(recorded.usage.outputTokens).toBeNull();
    expect(Buffer.byteLength(JSON.stringify(recorded))).toBeLessThanOrEqual(receiptByteBound(f.host.description));
    const all = value(f.door.inspect());
    expect(all.some(v => v.record.type === 'JudgmentAttemptRecord' && v.record.phase === 'accounting-observed')).toBe(true);
    expect(all.at(-1)?.record).toMatchObject({ type: 'JudgmentResolution', disposition: 'refused' });
    expect(reservations(f).at(-1)?.record).toMatchObject({ state: 'consumed', charge: 20 }); expect(f.calls).toHaveLength(1);
  });
  it('P7-NF-11 P7-NF-14 P7-NF-17 R4 stop before claim never records dispatch and prepared reservation cannot forge it', async () => {
    const f = judgmentFixture({ storage: base => ({ ...base, append: (bytes, head) => {
      const result = base.append(bytes, head), record = JSON.parse(bytes).body?.record;
      if (record?.type === 'AdmissionReservation' && record.state === 'prepared') f.stop(); return result;
    } }) });
    refused(await f.door.judge(f.input, f.start()), 'stop'); expect(f.calls).toHaveLength(0);
    const all = value(f.door.inspect()); expect(all).toHaveLength(2);
    const prepared = reservations(f)[0]!; expect(prepared.record).toMatchObject({ state: 'prepared' });
    if (prepared.record.type !== 'AdmissionReservation') throw new Error('missing reservation');
    refused(f.spine.append({ type: 'JudgmentAttemptRecord', schemaVersion: 1, id: 'forged:dispatch', request: f.input.id,
      predecessor: all.at(-1)!.fact.id, phase: 'dispatch-observed', attempt: `attempt:${f.input.id}:1`, operation: prepared.record.operation,
      reservation: prepared.fact.id } as JudgmentAttemptRecord), 'consumed six claim');
  });
  it('P7-NF-09 P7-NF-11 P7-NF-17 R4 no-call SDK leaves a claim, not an observed handoff, and cannot retry it', async () => {
    const f = judgmentFixture({ client: { automaticRetries: 0, execute: async () => {} } }), token = f.start();
    refused(await f.door.judge(f.input, token), 'no admitted'); expect(f.calls).toHaveLength(0);
    expect(value(f.door.inspect())).toHaveLength(2); expect(reservations(f).at(-1)?.record).toMatchObject({ state: 'dispatch-claimed' });
    const claim = reservations(f).at(-1)!; if (claim.record.type !== 'AdmissionReservation') throw new Error('claim missing');
    refused(f.spine.append({ type: 'JudgmentAttemptRecord', schemaVersion: 1, id: 'forged:claim-handoff', request: f.input.id,
      predecessor: value(f.door.inspect()).at(-1)!.fact.id, phase: 'dispatch-observed', attempt: `attempt:${f.input.id}:1`,
      operation: claim.record.operation, reservation: claim.fact.id } as JudgmentAttemptRecord), 'consumed six claim');
    refused(await createJudgmentDoorway(f.ports).judge(f.input, token), 'unresolved dispatch claim'); expect(f.calls).toHaveLength(0);
  });
  it('P7-NF-11 P7-NF-14 P7-NF-17 R4 the real provider sees an already recorded consumed-claim handoff', async () => {
    let observed = false;
    const f = judgmentFixture({ invoke: async () => {
      const dispatched = value(f.door.inspect()).find(v => v.record.type === 'JudgmentAttemptRecord' && v.record.phase === 'dispatch-observed');
      expect(dispatched?.record).toMatchObject({ reservation: reservations(f).at(-1)!.fact.id });
      expect(reservations(f).at(-1)?.record).toMatchObject({ state: 'consumed' }); observed = true; return f.observation;
    } });
    value(await f.door.judge(f.input, f.start())); expect(observed).toBe(true); expect(f.calls).toHaveLength(1);
  });
  it('P7-NF-14 P7-NF-15 P7-NF-17 R4 interrupted handoff recording cannot turn consumed permission into a new invocation', async () => {
    let fail = true;
    const f = judgmentFixture({ storage: base => ({ ...base, append: (bytes, head) => fail && bytes.includes('dispatch-observed')
      ? f.result(() => { throw new Error('handoff append interrupted'); }) : base.append(bytes, head) }) }), token = f.start();
    refused(await f.door.judge(f.input, token), 'no admitted'); expect(f.calls).toHaveLength(0);
    expect(reservations(f).at(-1)?.record).toMatchObject({ state: 'consumed' }); fail = false;
    refused(await createJudgmentDoorway(f.ports).judge(f.input, token), 'unresolved dispatch claim');
    refused(f.door.resumeRecording(f.input.id), 'receipt missing'); expect(f.calls).toHaveLength(0);
  });
});
