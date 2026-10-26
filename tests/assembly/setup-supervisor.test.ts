import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error Installer host composition.
import { runSetupSupervisor } from '../../scripts/setup-supervisor.mjs';
// @ts-expect-error Closed setup protocol.
import { CHECKS, PRECHECKS, decodeSetupDecision, projectSetupChecks } from '../../scripts/setup-supervisor-protocol.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'setup-supervisor-')); roots.push(root);
  mkdirSync(join(root, '.onboarding'));
  const agentId = 'agent:12345678-1234-1234-1234-123456789abc';
  for (const file of ['identity', 'completed']) writeFileSync(join(root, `.onboarding/${file}.json`), JSON.stringify({ agentId }));
  const executed: string[] = [], validations: string[] = [];
  let reply = '{"disposition":"accept"}', available = true, now = 1, stopped = false, qualified = true;
  let ownerFail = false, afterExecute: (() => void) | undefined;
  const binding = { installation: agentId, session: 'setup-session', subject: 'a'.repeat(64), authority: 'preparation-grant' };
  const owners = {
    async inspect(checkpoint: any) {
      return { checkpoint: { ...checkpoint, frontier: 'owner-frontier' }, checks: (checkpoint.phase === 'pre' ? PRECHECKS : CHECKS)[checkpoint.step].map((name: string, index: number) => ({
        name, owner: checkpoint.step === 'append' ? 'one-two' : 'custodian', observed: true,
        passed: !(ownerFail && index === 0), receipt: `r${index + 1}`,
      })) };
    },
    async authenticate(record: any) { return record.checkpoint.frontier === 'owner-frontier'; },
    async reconcile(checkpoint: any) { return executed.includes(checkpoint.step) ? 'executed' : 'absent'; },
    async execute(checkpoint: any) { executed.push(checkpoint.step); afterExecute?.(); return 'executed'; },
  };
  const route = { async admit() { return qualified ? { digest: 'b'.repeat(64), qualified: true } : null; },
    async validate(record: any) { validations.push(`${record.checkpoint.step}:${record.checkpoint.phase}`);
      if (!available) throw Error('private provider diagnostic');
      return { state: 'complete', bytes: reply, usage: { inputTokens: 1, outputTokens: 1, charge: 0 }, cleanup: 'verified' }; } };
  const input = { root, login: { provider: 'openai', account: 'setup@example.test' }, binding, owners, route,
    clock: () => now, stopped: () => stopped };
  return { root, input, executed, validations, change(v: { reply?: string; available?: boolean; now?: number; stopped?: boolean; qualified?: boolean; ownerFail?: boolean; afterExecute?: () => void }) {
    if (v.reply !== undefined) reply = v.reply;
    if (v.available !== undefined) available = v.available;
    if (v.now !== undefined) now = v.now;
    if (v.stopped !== undefined) stopped = v.stopped;
    if (v.qualified !== undefined) qualified = v.qualified;
    if (v.ownerFail !== undefined) ownerFail = v.ownerFail;
    if (v.afterExecute !== undefined) afterExecute = v.afterExecute;
  } };
}
it('completes four bounded steps in a fresh temporary root after prepare-login through a stub qualified route', async () => {
  const f = fixture();
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'complete' });
  expect(f.executed).toEqual(['key', 'backup', 'signing', 'append']);
  expect(f.validations).toHaveLength(8);
  expect(JSON.parse(readFileSync(join(f.root, 'login-preparation/request.json'), 'utf8')).authority).toBeNull();
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'complete' });
  expect(f.executed).toHaveLength(4);
});
it.each(['{"disposition":"hold"}', '{"disposition":"uncertain"}', '', '{"reason":"accept"}'])('holds resumably on %s without interpreting prose', async reply => {
  const f = fixture(); f.change({ reply });
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'hold' }); expect(f.executed).toEqual([]);
  f.change({ reply: '{"disposition":"accept"}' });
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'complete' });
});
it('holds unavailable without leaking diagnostics; a repaired route resumes', async () => {
  const f = fixture(); f.change({ available: false });
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'hold', reason: 'model-unavailable' });
  expect(JSON.stringify(readdirSync(join(f.root, 'setup-supervision')))).not.toContain('private provider');
  f.change({ available: true }); expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'complete' });
});
it('reconciles an executed step after a post-step hold, never repeating its effect', async () => {
  const f = fixture(); f.change({ afterExecute: () => f.change({ reply: '{"disposition":"hold"}' }) });
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'hold' }); expect(f.executed).toEqual(['key']);
  f.change({ reply: '{"disposition":"accept"}', afterExecute: () => {} });
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'complete' }); expect(f.executed).toEqual(['key', 'backup', 'signing', 'append']);
});
it('holds unqualified routes, failed owners and durable stop before dispatch', async () => {
  for (const change of [{ qualified: false }, { ownerFail: true }, { stopped: true }]) {
    const f = fixture(); f.change(change); expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'hold' }); expect(f.executed).toEqual([]);
  }
  const f = fixture(); expect(await runSetupSupervisor({ ...f.input, route: undefined })).toMatchObject({ reason: 'route-unqualified' });
});
it('refuses credentials, caller write paths and symlink escape without touching the outside', async () => {
  for (const extra of [{ credential: 'must-not-be-retained' }, { output: '../outside' }]) {
    const f = fixture(); expect(await runSetupSupervisor({ ...f.input, ...extra })).toMatchObject({ state: 'hold', reason: 'invalid-input' });
    expect(readdirSync(f.root)).toEqual(['.onboarding']);
  }
  const f = fixture(), outside = mkdtempSync(join(tmpdir(), 'setup-outside-')); roots.push(outside);
  symlinkSync(outside, join(f.root, 'setup-supervision'));
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'hold', reason: 'unsafe-path' });
  expect(readdirSync(outside)).toEqual([]);
});
it('preserves uncertain effect dispatch and refuses changed checkpoint subjects', async () => {
  const f = fixture(); f.input.owners.execute = async () => { throw Error('unknown effect'); };
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'hold', reason: 'effect-uncertain' });
  expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'hold', reason: 'effect-uncertain' });
  expect(await runSetupSupervisor({ ...f.input, binding: { ...f.input.binding, subject: 'c'.repeat(64) } })).toMatchObject({ state: 'hold', reason: 'binding-changed' });
});
it('does not advance past a deadline or a stop that arrives during validation', async () => {
  for (const change of [{ now: 120002 }, { stopped: true }]) {
    const f = fixture(), validate = f.input.route.validate;
    f.input.route.validate = async r => { const result = await validate(r); f.change(change); return result; };
    expect(await runSetupSupervisor(f.input)).toMatchObject({ state: 'hold' }); expect(f.executed).toEqual([]);
  }
});
it('rejects fabricated, missing, duplicate and foreign owner results', async () => {
  const f = fixture(), checkpoint = { ...f.input.binding, step: 'key', phase: 'pre', operation: 'key-op', schema: 'setup-owner-results-v1' };
  const record = await f.input.owners.inspect(checkpoint);
  expect(projectSetupChecks(record, checkpoint).checks).toHaveLength(PRECHECKS.key.length);
  for (const mutate of [(r: any) => r.checks.pop(), (r: any) => r.checks.push(r.checks[0]),
    (r: any) => { r.checks[0].observed = false; }, (r: any) => { r.checkpoint.subject = 'foreign'; },
    (r: any) => { r.checks[0].credential = 'secret'; }]) {
    const bad = structuredClone(record); mutate(bad); expect(() => projectSetupChecks(bad, checkpoint)).toThrow();
  }
});
it('replays recorded uncertain summaries, Jev, reply reviews and empty candidates through the new decision path', () => {
  const corpus = JSON.parse(readFileSync('tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', 'utf8'));
  for (const row of corpus.otherShapes) expect(decodeSetupDecision(row.raw)).toBe('hold');
  for (const set of ['original', 'held-out']) {
    const evidence = JSON.parse(readFileSync(`tests/qualification/evidence/macos-arm64-2026-10-25-option1b-3b-${set}.json`, 'utf8'));
    for (const trial of evidence.trials) {
      // Historical shape is audited, never silently treated as the newly qualified contract.
      expect(decodeSetupDecision(trial.output)).toBe('hold');
    }
  }
});

it('enforces the overall attempt ceiling, current owner frontier and current qualified pins on resume', async () => {
  const timed = fixture(); timed.change({ afterExecute: () => timed.change({ now: 1200002 }) });
  expect(await runSetupSupervisor(timed.input)).toMatchObject({ reason: 'attempt-deadline' });
  expect(timed.executed).toEqual(['key']);
  const changed = fixture(), original = changed.input.route.validate, originalInspect = changed.input.owners.inspect;
  changed.input.route.validate = async record => {
    const result = await original(record);
    changed.input.owners.inspect = async checkpoint => ({ ...await originalInspect(checkpoint), checkpoint: { ...checkpoint, frontier: 'changed' } });
    return result;
  };
  expect(await runSetupSupervisor(changed.input)).toMatchObject({ state: 'hold' }); expect(changed.executed).toEqual([]);
  const pinned = fixture(), validate = pinned.input.route.validate;
  pinned.input.route.validate = async record => { const result = await validate(record); pinned.change({ qualified: false }); return result; };
  expect(await runSetupSupervisor(pinned.input)).toMatchObject({ state: 'hold' });
});
it('rejects duplicate decision fields and never recovers acceptance from audit prose', () => {
  for (const raw of ['{"disposition":"hold","disposition":"accept"}', '{"disposition":"hold","reason":"accept"}', '{"disposition":"accept","credential":"not-retained"}'])
    expect(decodeSetupDecision(raw)).toBe('hold');
  expect(decodeSetupDecision(' { "disposition" : "accept" } ')).toBe('accept');
});
