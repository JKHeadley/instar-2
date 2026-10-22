// @ts-nocheck -- exercises JavaScript physical boundaries with disposable homes only.
import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conversationSessionAnswer } from './conversation-session-answer.js';
import { createHarnessLoginPool } from './harness-login-pool.mjs';
import { createClaudePoolQuota } from '../../scripts/claude-pool-quota.mjs';
import { createTopicLoginHandoff } from '../../scripts/topic-login-pool.mjs';
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
import { createConversationHostStore } from '../../scripts/conversation-host-store.mjs';
import { createConversationTopicsPort } from '../../src/assembly/conversation-topics.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
const roots = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const hash = text => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const tick = () => new Promise(resolve => setTimeout(resolve, 1));
async function until(test) { for (let n = 0; n < 500 && !test(); n++) await tick(); expect(test()).toBe(true); }
function fixture(liveQuota = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'topic-pool-'))); roots.push(root);
  const project = join(root, 'scope'); mkdirSync(project);
  let now = 1000000, stopped = false, failCopy = false, failCommit = false, failAdmit = false, failValidate = false;
  const entries = ['a', 'b'].map((name, index) => { const home = join(root, name); mkdirSync(home);
    return { index, profile: { reference: name, expectedAccount: `${name}@example.invalid`, configDirectory: home } }; });
  const quota = (entry, pct, status = 'active') => ({ email: entry.profile.expectedAccount, configHome: entry.profile.configDirectory,
    status, lastQuota: { measuredAt: new Date(now).toISOString(), fiveHour: { utilizationPct: pct, resetsAt: new Date(now + 3600000).toISOString() },
      sevenDay: { utilizationPct: pct, resetsAt: new Date(now + 3600000).toISOString() } } });
  let usage = { version: 1, accounts: entries.map(entry => quota(entry, 20)) };
  const raw = JSON.parse(readFileSync(new URL('./fixtures/claude-usage-2026-10-22.json', import.meta.url), 'utf8'));
  let pressured = 0;
  const quotaReader = liveQuota ? createClaudePoolQuota({ entries, now: () => now, stopped: () => stopped,
    validate: () => {}, credential: entry => String(entry.index),
    fetchImpl: async (_url, request) => {
      const body = structuredClone(raw);
      if (pressured && request.headers.Authorization === 'Bearer 0') body.seven_day.utilization = pressured;
      return new Response(JSON.stringify(body));
    } }) : null;
  const settings = { quotaReader, configuration: { entries, threshold: 95, identity: 'fixture', current: () => true },
    machine: 'test-linux', statePath: join(root, 'pool.json'), now: () => now, validate: entry => { if (failValidate && entry.index === 1) throw Error('destination login unavailable'); }, usage: () => liveQuota ? null : usage };
  let pool = createHarnessLoginPool(settings);
  const physical = entry => { const io = createProductionSessionIO({ stateDirectory: join(root, 'physical'), tmuxPath: '/synthetic',
    home: entry.profile.configDirectory, configHome: entry.profile.configDirectory, cwd: project });
    return { ...io, carryTranscript: input => { if (failCopy) throw Error('crash at copy'); return io.carryTranscript(input); } }; };
  physical(entries[0]);
  const transcript = (entry, id) => join(entry.profile.configDirectory, 'projects', project.replace(/[\/.]/g, '-'), `${id}.jsonl`);
  const writeTranscript = (entry, id, text) => { const path = transcript(entry, id); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text); };
  const stores = new Map(), handoffs = new Map(), busy = new Set(), held = new Set(), deliveries = [], launches = [], closes = [], edges = [];
  let live = 0, state = null, port, answer = null;
  const handoffFor = topic => {
    if (handoffs.has(topic)) return handoffs.get(topic);
    const disk = createConversationHostStore(join(root, `login-${topic}.json`), new Uint8Array(32).fill(7));
    stores.set(topic, disk);
    const handoff = createTopicLoginHandoff({ topic, pool, entries, store: { load: disk.load, save: next => {
      if (failCommit && next.selected === 1 && !next.pending) throw Error('crash at commit'); disk.save(next);
    } }, physical, project, framework: 'claude-code', admit: async () => { if (failAdmit) throw Error('destination unavailable'); } });
    handoffs.set(topic, handoff); return handoff;
  };
  const base = { context: assemblyRuntimeFixture().c, conversation: 'operator', topicOf: operation => operation.split(':')[0],
    allowanceDeadline: now + 100000, authorized: () => true, currentAuthority: () => 'grant', maxSessions: 2, idleMs: 5000,
    deadlineMs: 100000, pollMs: 25, maxSteps: 20, maxCalls: 20, maxResultBytes: 65536,
    now: () => now, stopped: () => stopped, parent: 'run', owner: 'machine', placement: 'local', transport: 'fake',
    workingScope: project, resultDirectory: project, artifact: 'artifact', incarnation: 'boot',
    store: { load: () => structuredClone(state), save: next => { state = structuredClone(next); } }, append: row => edges.push(row),
    resources: { admit: async () => { live++; return { attach: async () => {}, release: async () => { live--; return true; } }; } },
    io: { modelCalls: () => { throw Error('must use durable topic charges'); }, wait: tick, readResult: () => null, clearResult: () => {},
      prepareAdmission: () => {}, closeAdmission: () => {}, admissionState: () => ({ refused: false, openDelegations: [] }) } };
  const config = { ...base, createAdapter: () => { throw Error('must use topic binding'); }, topicConfig: topic => {
    const h = handoffFor(topic);
    return { ...base, currentAuthority: () => `grant:${h.current().index}`, prepareTurn: h.prepareTurn, createAdapter: () => ({
      describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: true }),
      launch: async input => {
        h.bindClaim(input.claim);
        const entry = h.current(), io = physical(entry), journal = io.load();
        const prior = journal.resumes[input.claim];
        const resume = h.resumeAllowed && prior && io.transcriptExists('claude-code', prior, project, entry.profile.configDirectory);
        const id = resume ? prior : `11111111-2222-4333-8444-${String(launches.length).padStart(12, '0')}`;
        if (!resume) writeTranscript(entry, id, 'new conversation\n');
        io.save({ ...journal, resumes: { ...journal.resumes, [input.claim]: id } });
        const worker = { ...input, launch: `worker-${launches.length}` };
        launches.push({ topic, login: entry.index, id, resume: !!resume, worker }); h.launched(); return worker;
      },
      deliver: async input => { busy.add(topic); port.reserveCall(input.claim, state.topics[topic].claimCalls + 1);
        deliveries.push({ topic, login: h.current().index, input }); return { state: 'accepted', evidence: 'fake' }; },
      observe: async input => {
        if (!input.delivery || held.has(topic)) return { observations: [], cursor: input.cursor, complete: true };
        busy.delete(topic); const text = answer ?? `answer ${input.delivery.operation}`;
        return { observations: [{ kind: 'reply', delivery: input.delivery.operation, text, digest: hash(text) },
          { kind: 'turn-end', delivery: input.delivery.operation, state: 'completed' }], cursor: input.cursor + 2, complete: true };
      },
      control: async input => { expect(busy.has(topic)).toBe(false); closes.push({ topic, ...input }); return { state: 'closed', evidence: 'exact' }; },
    }) };
  } };
  const open = () => { port = value(createConversationTopicsPort(config)); }; open();
  const request = operation => ({ operation, question: operation, context: 'recorded topic history', authority: 'grant' });
  return { get port() { return port; }, request, entries, quota, settings, get pool() { return pool; }, physical, project, transcript, writeTranscript,
    handoffFor, handoffs, stores, held, deliveries, launches, closes, edges, state: () => state, reply: text => { answer = text; },
    pressure: (pct = 80) => { pressured = pct; },
    usage: accounts => { usage = { version: 1, accounts }; }, advance: ms => { now += ms; },
    failCopy: value => { failCopy = value; }, failCommit: value => { failCommit = value; }, failAdmit: value => { failAdmit = value; },
    failValidate: value => { failValidate = value; },
    stop: () => { stopped = true; },
    restart: () => { pool = createHarnessLoginPool(settings); handoffs.clear(); open(); } };
}

it('moves only an idle topic; the in-flight topic finishes on A then moves, with resume and no duplicate input', async () => {
  const f = fixture(); await f.port.run(f.request('8:first')); f.held.add('7');
  const active = f.port.run(f.request('7:first')); await until(() => f.deliveries.length === 2);
  f.usage([f.quota(f.entries[0], 95), f.quota(f.entries[1], 20)]);
  await f.port.maintain();
  expect(f.handoffFor('8').current().index).toBe(1); expect(f.handoffFor('7').current().index).toBe(0);
  expect(f.closes.map(row => row.topic)).toEqual(['8']);
  expect(await f.port.run(f.request('8:second'))).toMatchObject({ state: 'complete' });
  expect(f.launches.at(-1)).toMatchObject({ topic: '8', login: 1, resume: true });
  expect(f.launches.at(-1).id).toBe(f.launches[0].id);
  expect(f.state().topics['8'].authority).toBe('grant:1');
  expect(f.state().topics['7'].authority).toBe('grant:0');
  f.held.delete('7'); expect(await active).toMatchObject({ state: 'complete' });
  await f.port.maintain(); expect(f.handoffFor('7').current().index).toBe(1);
  await f.port.run(f.request('7:second')); await f.port.run(f.request('7:first'));
  expect(f.deliveries.map(row => [row.topic, row.login])).toEqual([['8', 0], ['7', 0], ['8', 1], ['7', 1]]);
  expect(f.pool.state.handoffs.map(row => row.topic)).toEqual(['8', '7']);
  expect(f.edges.filter(row => row.type === 'SessionWorkEdge' && !row.drawsOn)).toHaveLength(1);
  expect(Object.values(f.state().topics).reduce((sum, row) => sum + row.spent, 0)).toBe(4);
  await f.port.close();
});

it.each(['copy', 'commit'])('recovers the durable switch after a crash at %s without replay or a second completed move', async point => {
  const f = fixture(true); await f.port.run(f.request('7:first'));
  f.pressure(95); f.advance(60_000);
  if (point === 'copy') f.failCopy(true); else f.failCommit(true);
  await expect(f.port.maintain()).rejects.toThrow('crash');
  expect(f.stores.get('7').load().pending).toMatchObject({ from: 0, to: 1 });
  expect(f.deliveries).toHaveLength(1);
  f.failCopy(false); f.failCommit(false); f.restart(); await f.port.maintain();
  expect(f.handoffFor('7').current().index).toBe(1);
  expect(f.pool.state.handoffs).toHaveLength(1); expect(f.pool.state.switches).toHaveLength(1);
  await f.port.run(f.request('7:first')); expect(f.deliveries).toHaveLength(1);
  await f.port.run(f.request('7:second'));
  expect(f.launches.at(-1)).toMatchObject({ login: 1, resume: true }); await f.port.close();
});

it('leaves input durably queued while every account is full; the parent deadline still stops work', async () => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  f.usage(f.entries.map(entry => f.quota(entry, 99)));
  expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'queued' });
  expect(f.state().topics['7'].inputs.at(-1).state).toBe('queued'); expect(f.deliveries).toHaveLength(1);
  f.advance(100001); // Original parent lifetime still wins while waiting for capacity.
  await f.port.maintain(); expect(f.deliveries).toHaveLength(1);
  expect(f.port.available()).toBe(false);
});

it('healthy topics stay put and a failed destination preflight does not retire the old worker', async () => {
  const f = fixture(); await f.port.run(f.request('7:first')); await f.port.maintain(); expect(f.closes).toEqual([]);
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]); f.failAdmit(true);
  await f.port.maintain();
  expect(f.closes).toEqual([]); expect(f.pool.state.switches).toEqual([]);
  f.failAdmit(false); await f.port.maintain(); expect(f.closes).toHaveLength(1); await f.port.close();
});

it.each(['divergent', 'missing'])('never resumes %s transcript bytes and retains the source evidence', async mode => {
  const f = fixture(); await f.port.run(f.request('7:first')); const id = f.launches[0].id;
  if (mode === 'divergent') f.writeTranscript(f.entries[1], id, 'different conversation\n');
  else rmSync(f.transcript(f.entries[0], id));
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]);
  await f.port.run(f.request('7:second'));
  expect(f.pool.state.handoffs[0].continuity).toBe('journal'); expect(f.launches.at(-1).resume).toBe(false);
  if (mode === 'divergent') expect(readFileSync(f.transcript(f.entries[1], id), 'utf8')).toBe('different conversation\n');
  await f.port.close();
});

it('detects lost topic custody and refuses to guess the account after restart', async () => {
  const f = fixture(); await f.port.run(f.request('7:first')); await f.port.close();
  const disk = f.stores.get('7'); f.restart();
  expect(() => createTopicLoginHandoff({ topic: '7', pool: f.pool, entries: f.entries,
    store: { ...disk, load: () => null }, physical: f.physical, project: f.project, framework: 'claude-code', admit: async () => {} })).toThrow('custody lost');
});

it('requires fresh complete destination readings and retains a healthy current account with unknown quota', () => {
  const f = fixture(); f.usage([]); expect(f.pool.selectSession(0)).toBe(f.entries[0]);
  f.usage([f.quota(f.entries[0], 95)]); expect(f.pool.selectSession(0)).toBeNull();
  const partial = f.quota(f.entries[1], 10); delete partial.lastQuota.sevenDay;
  f.usage([f.quota(f.entries[0], 95), partial]); expect(f.pool.selectSession(0)).toBeNull();
  f.usage([f.quota(f.entries[0], 95), f.quota(f.entries[1], 10)]); expect(f.pool.selectSession(0)).toBe(f.entries[1]);
});

it('retains the five-attempt ten-minute brake across restart', () => {
  const f = fixture(); const state = f.pool.state;
  state.handoffAttempts = Array.from({ length: 5 }, (_, index) => ({ from: 'a', to: 'b', reason: 'usage-threshold', phase: 'prepared',
    at: Date.parse(f.quota(f.entries[0], 10).lastQuota.measuredAt), sequence: index + 1 }));
  writeFileSync(f.settings.statePath, JSON.stringify(state)); f.restart();
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 20)]); expect(f.pool.selectSession(0)).toBeNull();
  f.advance(600001); f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 20)]); expect(f.pool.selectSession(0)).toBe(f.entries[1]);
});

it('records one identity-matched sign-in repair across restart, never generic or ambiguous failures', () => {
  const f = fixture(); f.usage([f.quota(f.entries[0], 10, 'needs-reauth'), f.quota(f.entries[1], 10)]);
  expect(f.pool.selectSession(0)).toBe(f.entries[1]); f.restart(); f.pool.selectSession(1);
  expect(f.pool.signinRepairs()).toEqual([expect.objectContaining({ account: 'a@example.invalid', machine: 'test-linux' })]);
  f.usage([f.quota(f.entries[0], 10, 'error'), f.quota(f.entries[1], 10)]); f.pool.selectSession(1); expect(f.pool.signinRepairs()).toHaveLength(1);
  const g = fixture(); g.usage([g.quota(g.entries[0], 10, 'needs-reauth'), g.quota(g.entries[0], 10), g.quota(g.entries[1], 10)]);
  expect(g.pool.selectSession(0)).toBe(g.entries[0]); expect(g.pool.signinRepairs()).toEqual([]);
  g.usage([{ ...g.quota(g.entries[0], 10, 'needs-reauth'), email: 'wrong@example.invalid' }, g.quota(g.entries[1], 10)]);
  expect(g.pool.selectSession(0)).toBe(g.entries[0]); expect(g.pool.signinRepairs()).toEqual([]);
});

it('does not follow a transcript symlink or replace divergent bytes; an identical copy is reusable', () => {
  const f = fixture(), id = '11111111-2222-4333-8444-555555555555';
  f.writeTranscript(f.entries[0], id, 'source\n'); f.writeTranscript(f.entries[1], id, 'destination\n');
  const input = { framework: 'claude-code', id, project: f.project, source: f.entries[0].profile.configDirectory, target: f.entries[1].profile.configDirectory };
  expect(f.physical(f.entries[0]).carryTranscript(input)).toBe('divergent');
  expect(readFileSync(f.transcript(f.entries[1], id), 'utf8')).toBe('destination\n');
  rmSync(f.transcript(f.entries[1], id)); symlinkSync(f.transcript(f.entries[0], id), f.transcript(f.entries[1], id));
  expect(f.physical(f.entries[0]).carryTranscript(input)).toBe('unavailable');
  rmSync(f.transcript(f.entries[1], id)); f.writeTranscript(f.entries[1], id, 'source\n');
  expect(f.physical(f.entries[0]).carryTranscript(input)).toBe('identical');
});

it('drains a capacity wait after a fresh reset, without another input submission', async () => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  const full = f.entries.map(entry => f.quota(entry, 99));
  for (const account of full) for (const window of ['fiveHour', 'sevenDay'])
    account.lastQuota[window].resetsAt = new Date(Date.parse(account.lastQuota.measuredAt) + 1000).toISOString();
  f.usage(full); expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'queued' });
  f.advance(1001); f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 20)]);
  await f.port.maintain(); expect(f.deliveries.map(row => row.login)).toEqual([0, 1]);
  expect(await f.port.collect('7:second')).toMatchObject({ outcome: { state: 'complete' } }); await f.port.close();
});

it('the shipped configuration captures each topic account for launch, observation, admission and exact retirement', async () => {
  const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  const factory = source.split('      const configurationFor = ')[1].split('\n      const defaultBinding = ')[0]
    .replaceAll('import.meta.url', JSON.stringify(new URL('./journal-agent.mjs', import.meta.url).href));
  const drivers = [], observed = [], admitted = [], stopped = [], bound = [], activities = [];
  const recovery = [{ kind: 'dispatch-intent', claim: 'prior-claim' }];
  const journal = { view: { expires: 100000, order: [] }, sessionWorkRecords: () => recovery };
  const env = { join, conversationSession: true, sessionAdapter: {}, sha256: () => 'a'.repeat(64), conversationOf: () => 'operator', g: {}, journal,
    sessionWork: { authority: 'grant' }, createProductionSessionDriver: config => {
      drivers.push(config); return { owner: 'part-eight', launch: () => ({ kind: 'Success', value: 'worker' }),
        deliver: () => ({}), observe: () => ({}), stop: target => { stopped.push(target); return {}; } };
    }, sessionAdmissionCommand: () => 'hook', admissionBase: '/admission', layout: null,
    sessionLimits: { deadlineMs: 10000, maxSessions: 2, pollMs: 25, maxResultBytes: 65536, maxStepsPerLaunch: 10, maxCallsPerStep: 20 },
    gate: { base: () => '/gate' }, sessionConnectors: new Map(), framework: 'claude-code', project: '/scope',
    required: () => 'model', options: {}, context: {}, wallNow: () => 1000, fileURLToPath: url => url.pathname,
    workingActivities: { observeSession: (session, result) => activities.push({ session, result }) },
    observeHarnessSessionLimit: (_pool, entry, result) => { observed.push(entry.index); return result; }, loginPool: {},
    loginRuntimes: new Map([[0, { check: () => {} }], [1, { check: () => {} }]]),
    doorway: { id: 'doorway', session: { admit: async input => { admitted.push(input.profile.reference); } } },
    hostResources: { hold: async () => ({ attach: async () => {}, release: async () => ({ verified: true }) }) },
    hostStopped: () => false, ownerMachine: 'local', launchedAt: 1000, delay: tick,
  };
  const make = Function(...Object.keys(env), `return ${factory}`)(...Object.values(env));
  const entry = index => ({ index, profile: { reference: `login-${index}`, executable: '/cli', home: `/home-${index}`, configDirectory: `/config-${index}` } });
  let selected = 0;
  const binding = index => ({ entry: () => entry(index === null ? selected : index),
    physical: () => ({ inboxDirectory: '/inbox', transcriptExists: () => true,
      load: () => ({ sessions: [{ identity: `worker-${index === null ? selected : index}`, login: index === null ? selected : index }] }) }), harness: () => null,
    authorized: () => true, stopped: () => false, admissionIO: () => ({}) });
  let resumed = false;
  const a = make('7', binding(0));
  const b = make('8', binding(null), { prepareTurn: async () => true, bindClaim: claim => bound.push(claim),
    get resumeAllowed() { return false; }, get continuing() { return true; }, launched: () => { resumed = true; } });
  expect(a.recoveryEdges()).toBe(recovery); expect(b.recoveryEdges()).toBe(recovery);
  recovery.push({ kind: 'result', claim: 'prior-claim' });
  expect(b.recoveryEdges()).toHaveLength(2);
  expect(a.sessionConfiguration().configHome).toBe('/config-0');
  const da = a.createDriver(() => ''), db = b.createDriver(() => '');
  selected = 1;
  db.launch({ claim: 'claim-8' }); da.launch({ claim: 'claim-7' });
  expect(drivers.slice(-2).map(config => config.configHome)).toEqual(['/config-1', '/config-0']);
  expect(drivers.at(-2).continuationRequired()).toBe(true); expect(drivers.at(-2).io.transcriptExists()).toBe(false);
  expect(bound).toEqual(['claim-8']); expect(resumed).toBe(true);
  db.observe({ processIdentity: 'worker-1' }); da.observe({ processIdentity: 'worker-0' });
  expect(observed).toEqual([1, 0]);
  expect(activities).toEqual([{ session: { identity: 'worker-1', login: 1 }, result: {} },
    { session: { identity: 'worker-0', login: 0 }, result: {} }]);
  await b.resources.admit(); await a.resources.admit(); expect(admitted).toEqual(['login-1', 'login-0']);
  db.stop({ claim: 'claim-8', incarnation: 'epoch-2' });
  expect(stopped).toEqual([{ claim: 'claim-8', incarnation: 'epoch-2' }]);
});

const recorded = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
it.each(recorded.otherShapes)('the pool replacement carries recorded $kind ($id) unchanged to the existing consumer', async row => {
  const f = fixture(true); await f.port.run(f.request('7:first'));
  f.pressure(95); f.advance(60_000);
  // Writer/Jev/review outputs remain quoted context. Historical delivered/empty
  // replies also exercise the answer field with their exact recorded bytes.
  const output = ['delivered-reply', 'empty-reply-in-recorded-context'].includes(row.kind)
    ? JSON.stringify({ reply: row.raw, memory: [] }) : JSON.stringify({ reply: 'Continued.', memory: [] });
  f.reply(output);
  const request = { ...f.request('7:recorded'), context: JSON.stringify({ recordedShape: row }) };
  f.failValidate(true);
  expect(await f.port.run(request)).toMatchObject({ state: 'queued' });
  expect(f.deliveries).toHaveLength(1); expect(f.closes).toEqual([]);
  f.failValidate(false); await f.port.maintain();
  const moved = await f.port.run(request);
  expect(f.pool.state.handoffs).toHaveLength(1); expect(f.launches.at(-1)).toMatchObject({ login: 1, resume: true });
  expect(f.deliveries.at(-1).input.text).toContain(JSON.stringify(row.raw));
  expect(moved.text).toBe(output);
  const after = conversationSessionAnswer(moved, 'recorded', () => {});
  expect(after).toEqual(conversationSessionAnswer({ state: 'complete', text: output }, 'recorded', () => {}));
  if (row.kind === 'empty-reply-in-recorded-context') expect(JSON.parse(after.text).reply).toBe('');
  // The journal's decision consumer, exercised in journal-conversation-session.test.ts, classifies this empty field.
  f.restart(); expect(await f.port.run(request)).toEqual(moved); expect(f.deliveries).toHaveLength(2);
  await f.port.close();
});


it('rechecks a pending destination after restart and retains input if that account has since filled', async () => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]); f.failCopy(true);
  await expect(f.port.maintain()).rejects.toThrow('crash');
  f.failCopy(false); f.restart(); f.usage(f.entries.map(entry => f.quota(entry, 99)));
  expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'queued' });
  expect(f.pool.state.switches).toEqual([]); expect(f.deliveries).toHaveLength(1);
  expect(f.handoffFor('7').state.pending).toMatchObject({ from: 0, to: 1 });
  expect(f.pool.state.handoffAttempts).toHaveLength(1); await f.port.close();
});

it('queues an undispatched input on destination preflight failure and drains it once admission recovers', async () => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  const before = f.state().topics['7'];
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]); f.failAdmit(true);
  const request = f.request('7:second');
  expect(await f.port.run(request)).toMatchObject({ state: 'queued' });
  expect(f.state().topics['7'].inputs.at(-1)).toMatchObject({ state: 'queued', attempts: 0, delivery: null });
  expect(f.state().topics['7'].claim).toBe(before.claim);
  expect(f.closes).toEqual([]); expect(f.deliveries).toHaveLength(1);
  await f.port.maintain(); expect(f.closes).toEqual([]);
  f.failAdmit(false); await f.port.maintain();
  expect(await f.port.run(request)).toMatchObject({ state: 'complete' });
  expect(f.deliveries.map(row => row.login)).toEqual([0, 1]);
  expect(f.pool.state.handoffAttempts).toHaveLength(1);
  expect(f.state().topics['7'].edge.budget.deadline).toBe(before.edge.budget.deadline);
  await f.port.maintain(); expect(f.deliveries).toHaveLength(2); await f.port.close();
});

it.each(['stop', 'deadline'])('preflight wait does not cross its original %s boundary', async boundary => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]); f.failAdmit(true);
  expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'queued' });
  if (boundary === 'stop') f.stop(); else f.advance(100001);
  f.failAdmit(false); await f.port.maintain();
  expect(f.deliveries).toHaveLength(1); expect(f.pool.state.handoffs ?? []).toHaveLength(0);
});

it('reconciles an already completed move even if destination capacity is now full', async () => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]); f.failCommit(true);
  await expect(f.port.maintain()).rejects.toThrow('crash at commit');
  expect(f.pool.state.handoffs).toHaveLength(1);
  f.failCommit(false); f.restart(); f.usage(f.entries.map(entry => f.quota(entry, 99)));
  expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'queued' });
  expect(f.handoffFor('7').state).toMatchObject({ selected: 1, pending: null });
  expect(f.pool.state.handoffs).toHaveLength(1); expect(f.pool.state.handoffAttempts).toHaveLength(1);
  expect(f.deliveries).toHaveLength(1); await f.port.close();
});

it('rechecks a preflight-interrupted pending move and drains only after fresh destination capacity returns', async () => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]); f.failAdmit(true);
  expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'queued' });
  f.failAdmit(false); f.restart();
  const full = f.quota(f.entries[1], 99);
  full.lastQuota.fiveHour.resetsAt = full.lastQuota.sevenDay.resetsAt = new Date(1001000).toISOString();
  f.usage([f.quota(f.entries[0], 99), full]); await f.port.maintain();
  expect(f.deliveries).toHaveLength(1); expect(f.pool.state.handoffAttempts).toHaveLength(1);
  expect(f.handoffFor('7').state.pending).toMatchObject({ from: 0, to: 1 });
  f.advance(1001); f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]);
  await f.port.maintain();
  expect(f.deliveries.map(row => row.login)).toEqual([0, 1]);
  expect(f.pool.state.handoffAttempts).toHaveLength(1); expect(f.pool.state.handoffs).toHaveLength(1);
  expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'complete' });
  expect(f.deliveries).toHaveLength(2); await f.port.close();
});

it('does not disguise transcript custody failure as a preflight wait', async () => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]); f.failCopy(true);
  expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'uncertain', detail: 'crash at copy' });
  expect(f.deliveries).toHaveLength(1); expect(f.closes).toHaveLength(1); await f.port.close();
});

it.each(['initial', 'pending'])('queues on %s destination validation failure and delivers once after recovery', async phase => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  const before = f.state().topics['7'];
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]);
  if (phase === 'pending') {
    f.failAdmit(true); await f.port.maintain(); f.failAdmit(false);
    expect(f.handoffFor('7').state.pending).toMatchObject({ from: 0, to: 1 });
  }
  f.failValidate(true);
  expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'queued' });
  expect(f.state().topics['7'].inputs.at(-1)).toMatchObject({ state: 'queued', attempts: 0, delivery: null });
  expect(f.state().topics['7'].claim).toBe(before.claim);
  await f.port.maintain();
  expect(f.closes).toEqual([]); expect(f.deliveries).toHaveLength(1);
  expect(f.pool.state.handoffAttempts ?? []).toHaveLength(phase === 'pending' ? 1 : 0);
  f.failValidate(false); await f.port.maintain();
  expect(await f.port.collect('7:second')).toMatchObject({ outcome: { state: 'complete' } });
  expect(f.deliveries.map(row => row.login)).toEqual([0, 1]);
  expect(f.pool.state.handoffAttempts).toHaveLength(1); expect(f.pool.state.handoffs).toHaveLength(1);
  expect(f.state().topics['7'].edge.budget.deadline).toBe(before.edge.budget.deadline);
  expect(f.state().topics['7'].spent).toBe(2);
  await f.port.run(f.request('7:second')); await f.port.maintain();
  expect(f.deliveries).toHaveLength(2); await f.port.close();
});

it.each(['stop', 'deadline'])('destination validation wait respects the original %s', async boundary => {
  const f = fixture(); await f.port.run(f.request('7:first'));
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]); f.failValidate(true);
  expect(await f.port.run(f.request('7:second'))).toMatchObject({ state: 'queued' });
  if (boundary === 'stop') f.stop(); else f.advance(100001);
  f.failValidate(false); await f.port.maintain();
  expect(f.deliveries).toHaveLength(1); expect(f.pool.state.handoffs ?? []).toHaveLength(0);
});

it('keeps manifest and pool persistence errors distinct from destination validation waits', () => {
  const f = fixture();
  f.settings.configuration.current = () => false;
  expect(() => f.pool.selectSession(0)).toThrow('manifest changed');
  expect(() => f.pool.readySession(0)).toThrow('manifest changed');
  f.settings.configuration.current = () => true;
  f.usage([f.quota(f.entries[0], 99), f.quota(f.entries[1], 10)]);
  const pool = createHarnessLoginPool({ ...f.settings, write: () => { throw Error('pool persistence failed'); } });
  expect(() => pool.selectSession(0)).toThrow('pool persistence failed');
  f.failValidate(true);
  expect(() => f.pool.select()).toThrow('destination login unavailable');
});

it('refreshes recorded live quota at the shipped topic boundary and resumes the same transcript before 95%', async () => {
  const f = fixture(true);
  await f.port.run(f.request('7:first'));
  const id = f.launches[0].id;
  f.pressure(); f.advance(60_000);
  await f.port.run(f.request('7:second'));
  expect(f.launches.at(-1)).toMatchObject({ login: 1, id, resume: true });
  expect(f.pool.state.handoffs).toHaveLength(1);
  expect(f.pool.state.handoffs[0].continuity).toBe('transcript');
  expect(f.deliveries.map(row => row.input.operation)).toEqual(['7:first', '7:second']);
  await f.port.close();
});
