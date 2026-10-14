// @ts-nocheck -- physical adapter and host pool are JavaScript; all homes below are disposable.
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarnessLoginPool } from './harness-login-pool.mjs';
import { createContinuingLoginHandoff } from '../../scripts/continuing-login-pool.mjs';
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true }); });
const uuid = '11111111-2222-4333-8444-555555555555';
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'session-pool-'))); roots.push(root);
  const project = join(root, 'scope'); mkdirSync(project);
  let now = Date.now(), selected, calls = 0, prepared = 0, stopped = 0, destination = '', busy = false;
  const launches = [], deliveries = [], rows = [], files = new Map();
  const entries = ['a', 'b'].map((name, index) => {
    const home = join(root, name); mkdirSync(home);
    return { index, profile: { reference: name, expectedAccount: `${name}@example.invalid`, configDirectory: home } };
  });
  selected = entries[0];
  const transcript = entry => join(entry.profile.configDirectory, 'projects', project.replace(/[\/.]/g, '-'), `${uuid}.jsonl`);
  const writeTranscript = (entry, text) => { mkdirSync(join(entry.profile.configDirectory, 'projects', project.replace(/[\/.]/g, '-')), { recursive: true }); writeFileSync(transcript(entry), text); };
  const quota = (entry, pct, status = 'active') => ({ email: entry.profile.expectedAccount, configHome: entry.profile.configDirectory,
    status, lastQuota: { measuredAt: new Date(now).toISOString(), fiveHour: { utilizationPct: pct, resetsAt: new Date(now + 3600000).toISOString() },
      sevenDay: { utilizationPct: pct, resetsAt: new Date(now + 3600000).toISOString() } } });
  let usage = { version: 1, accounts: entries.map(entry => quota(entry, 20)) };
  const settings = { configuration: { entries, threshold: 95, identity: 'fixture', current: () => true },
    machine: 'test-laptop', statePath: join(root, 'pool-state.json'), now: () => now, validate: () => {}, usage: () => usage };
  const pool = createHarnessLoginPool(settings);
  const adapter = () => createProductionSessionIO({ stateDirectory: join(root, 'state'), tmuxPath: '/synthetic', home: selected.profile.configDirectory,
    configHome: selected.profile.configDirectory, cwd: project });
  const physical = () => { const io = adapter(), directory = selected.profile.configDirectory;
    return { ...io, modelCalls: since => io.modelCalls('claude-code', project, directory, since),
      carryTranscript: input => io.carryTranscript({ ...input, framework: 'claude-code' }) }; };
  const handoff = createContinuingLoginHandoff({ pool, current: () => selected, physical, project,
    select: next => { selected = next; }, stop: () => { expect(busy).toBe(false); stopped++; }, record: move => pool.recordHandoff(move) });
  const f = assemblyRuntimeFixture();
  let onWait = async () => {};
  const port = value(createConversationSessionPort({ conversation: 'pool-test', prepareTurn: handoff.prepareTurn,
    createDriver: resolve => ({ owner: 'part-eight', launch: input => {
      launches.push({ login: selected.index, ...input });
      const io = adapter(), journal = io.load(); io.save({ ...journal, resumes: { ...journal.resumes, [input.claim]: uuid } });
      return f.success(`session:${launches.length}:1`);
    }, deliver: input => {
      busy = true; calls++; deliveries.push({ login: selected.index, text: resolve(input.intake, input.digest), ...input });
      let prior = ''; try { prior = readFileSync(transcript(selected), 'utf8'); } catch {}
      writeTranscript(selected, prior + JSON.stringify({ type: 'assistant', requestId: `request-${calls}` }) + '\n');
      files.set(destination, '{"answer":"done"}'); return f.success('accepted');
    }, observe: () => { busy = false; return f.success({ phase: 'output-observed', evidence: 'closed', detail: 'closed' }); },
    stop: () => { stopped++; return f.success([]); } }),
    io: { readResult: path => files.get(path) ?? null, clearResult: path => { destination = path; files.delete(path); },
      modelCalls: handoff.modelCalls, wait: async () => { await onWait(); }, prepareAdmission: () => { prepared++; },
      admissionState: () => ({ refused: false, openDelegations: [] }), closeAdmission: () => {} },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: f.c, now: () => now, stopped: () => false, append: row => rows.push(row), parent: 'parent', owner: 'test-laptop',
    placement: 'local', transport: 'fake', workingScope: project, resultDirectory: project, artifact: 'worker', incarnation: 'one',
    deadlineMs: 60000, pollMs: 25, maxResultBytes: 1024, maxSteps: 8, maxCalls: 3 }));
  const request = operation => ({ operation, question: operation, context: 'journal history', authority: 'same-role' });
  return { port, request, pool, settings, entries, transcript, writeTranscript, launches, deliveries, physical, project,
    counts: () => ({ prepared, stopped }), usage: accounts => { usage = { version: 1, accounts }; }, quota,
    wait: fn => { onWait = fn; }, advance: ms => { now += ms; }, selected: () => selected };
}

it('switches at the measured threshold only between closed turns, copies history and carries allowance', async () => {
  const f = fixture();
  let waits = 0;
  f.wait(async () => { if (++waits === 1) {
    f.usage([f.quota(f.entries[0], 95), f.quota(f.entries[1], 20)]);
    expect(f.launches).toHaveLength(1); expect(f.counts().stopped).toBe(0);
  } });
  expect((await f.port.run(f.request('first'))).state).toBe('complete');
  expect(f.launches).toHaveLength(1);
  expect((await f.port.run(f.request('second'))).state).toBe('complete');
  expect(f.deliveries.map(row => row.login)).toEqual([0, 1]);
  expect(f.launches[0].claim).toBe(f.launches[1].claim);
  expect(f.launches[0].incarnation).not.toBe(f.launches[1].incarnation);
  expect(f.counts()).toEqual({ prepared: 1, stopped: 1 });
  expect(f.pool.state.handoffs[0]).toMatchObject({ continuity: 'transcript', copy: 'copied', calls: 1 });
  expect(readFileSync(f.transcript(f.entries[1]), 'utf8')).toContain('request-1');
  expect(await f.port.close()).toMatchObject({ calls: 2, reserved: 3 });
});

it('keeps a healthy current login across turns', async () => {
  const f = fixture(); await f.port.run(f.request('first')); await f.port.run(f.request('second'));
  expect(f.launches).toHaveLength(1); expect(f.pool.state.switches).toHaveLength(0); await f.port.close();
});

it.each(['divergent', 'missing'])('keeps %s transcript evidence and records journal grounding instead of resuming a bad copy', async mode => {
  const f = fixture(); await f.port.run(f.request('first'));
  if (mode === 'divergent') f.writeTranscript(f.entries[1], 'different conversation\n');
  else rmSync(f.transcript(f.entries[0]));
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 5)]);
  expect((await f.port.run(f.request('second'))).state).toBe('complete');
  expect(f.pool.state.handoffs[0]).toMatchObject({ continuity: 'journal' });
  // The fake worker appends its own new result; the handoff itself never replaces old bytes.
  if (mode === 'divergent') expect(readFileSync(f.transcript(f.entries[1]), 'utf8')).toMatch(/^different conversation\n/);
  expect(await f.port.close()).toMatchObject({ calls: 2, reserved: 3 });
});

it('waits with the next input undelivered when all logins are full, then moves after a fresh reset', async () => {
  const f = fixture(); await f.port.run(f.request('first'));
  const full = f.entries.map(entry => f.quota(entry, 99));
  for (const account of full) for (const window of ['fiveHour', 'sevenDay'])
    account.lastQuota[window].resetsAt = new Date(Date.parse(account.lastQuota.measuredAt) + 1000).toISOString();
  f.usage(full);
  let waited = false;
  f.wait(async () => { if (!waited) {
    waited = true; expect(f.deliveries).toHaveLength(1); expect(f.counts().stopped).toBe(0);
    f.advance(1001); f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 20)]);
  } });
  expect((await f.port.run(f.request('second'))).state).toBe('complete');
  expect(waited).toBe(true); expect(f.deliveries.map(row => row.login)).toEqual([0, 1]);
  expect(await f.port.close()).toMatchObject({ calls: 2, reserved: 3 });
});

it('bounds pool churn with the durable five moves per ten minutes brake', () => {
  const f = fixture();
  const state = f.pool.state;
  state.switches = Array.from({ length: 5 }, (_, index) => ({ from: 'a', to: 'b', reason: 'usage-threshold',
    at: Date.parse(f.quota(f.entries[0], 10).lastQuota.measuredAt), sequence: index + 1 }));
  writeFileSync(f.settings.statePath, JSON.stringify(state));
  const reopened = createHarnessLoginPool(f.settings);
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 20)]);
  expect(reopened.selectSession(0)).toBeNull();
  f.advance(600001); f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 20)]);
  expect(reopened.selectSession(0)).toBe(f.entries[1]);
});

it('requires fresh complete destination readings and never treats unknown quota as room', () => {
  const f = fixture();
  f.usage([f.quota(f.entries[0], 95)]); expect(f.pool.selectSession(0)).toBeNull();
  const partial = f.quota(f.entries[1], 10); delete partial.lastQuota.sevenDay;
  f.usage([f.quota(f.entries[0], 95), partial]); expect(f.pool.selectSession(0)).toBeNull();
  f.usage([f.quota(f.entries[0], 95), f.quota(f.entries[1], 10)]); expect(f.pool.selectSession(0)).toBe(f.entries[1]);
});

it('records one signed-out account and machine item across polls and restart, never generic errors', () => {
  const f = fixture(); f.usage([f.quota(f.entries[0], 10, 'needs-reauth'), f.quota(f.entries[1], 10)]);
  expect(f.pool.selectSession(0)).toBe(f.entries[1]); f.pool.selectSession(1);
  const reopened = createHarnessLoginPool(f.settings); reopened.selectSession(1);
  expect(reopened.signinRepairs()).toEqual([expect.objectContaining({ account: 'a@example.invalid', machine: 'test-laptop' })]);
  expect(reopened.status()).toContain('a@example.invalid on test-laptop');
  f.usage([f.quota(f.entries[0], 10, 'error'), f.quota(f.entries[1], 10)]);
  reopened.selectSession(1); expect(reopened.signinRepairs()).toHaveLength(1);
});

it('does not follow a transcript symlink or replace a divergent destination', () => {
  const f = fixture(), io = f.physical();
  f.writeTranscript(f.entries[0], 'source\n'); f.writeTranscript(f.entries[1], 'destination\n');
  const input = { id: uuid, project: f.project, source: f.entries[0].profile.configDirectory, target: f.entries[1].profile.configDirectory };
  expect(io.carryTranscript(input)).toBe('divergent');
  expect(readFileSync(f.transcript(f.entries[1]), 'utf8')).toBe('destination\n');
  rmSync(f.transcript(f.entries[1])); symlinkSync(f.transcript(f.entries[0]), f.transcript(f.entries[1]));
  expect(io.carryTranscript(input)).toBe('unavailable');
  expect(readFileSync(f.transcript(f.entries[0]), 'utf8')).toBe('source\n');
});

it('closes at the original deadline without delivering or switching when every login remains full', async () => {
  const f = fixture(); await f.port.run(f.request('first'));
  f.usage(f.entries.map(entry => f.quota(entry, 99)));
  f.wait(async () => { f.advance(60001); });
  expect(await f.port.run(f.request('second'))).toMatchObject({ state: 'uncertain',
    detail: 'conversation capacity wait reached deadline; input was not delivered' });
  expect(f.deliveries).toHaveLength(1); expect(f.pool.state.switches).toHaveLength(0);
  expect(f.port.available()).toBe(false);
});

it('reuses an identical transcript and records no repair for ambiguous or wrong-account observations', () => {
  const f = fixture(); f.writeTranscript(f.entries[0], 'identical\n'); f.writeTranscript(f.entries[1], 'identical\n');
  expect(f.physical().carryTranscript({ id: uuid, project: f.project,
    source: f.entries[0].profile.configDirectory, target: f.entries[1].profile.configDirectory })).toBe('identical');
  f.usage([f.quota(f.entries[0], 10, 'needs-reauth'), f.quota(f.entries[0], 10), f.quota(f.entries[1], 10)]);
  expect(f.pool.selectSession(0)).toBe(f.entries[0]); expect(f.pool.signinRepairs()).toEqual([]);
  f.usage([{ ...f.quota(f.entries[0], 10, 'needs-reauth'), email: 'other@example.invalid' }, f.quota(f.entries[1], 10)]);
  expect(f.pool.selectSession(0)).toBe(f.entries[0]); expect(f.pool.signinRepairs()).toEqual([]);
});

it('does not stop the old worker if the destination admission fails', async () => {
  const f = fixture(); await f.port.run(f.request('first'));
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 20)]);
  const handoff = createContinuingLoginHandoff({ pool: f.pool, current: f.selected, physical: f.physical, project: f.project,
    admit: async () => { throw Error('destination authentication failed'); },
    stop: () => { throw Error('must not stop'); }, select: () => { throw Error('must not change home'); }, record: () => {} });
  await expect(handoff.prepareTurn({ claim: f.launches[0].claim, child: 'session:1:1', openedAt: 0 }))
    .rejects.toThrow('destination authentication failed');
  expect(f.counts().stopped).toBe(0); expect(f.selected()).toBe(f.entries[0]);
  await f.port.close();
});
