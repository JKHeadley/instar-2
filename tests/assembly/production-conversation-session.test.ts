import { expect, it } from 'vitest';
import { createConversationSessionPort, conversationSessionPrompt } from '../../src/assembly/production-conversation-session.js';
import type { ConversationSessionConfig } from '../../src/assembly/production-conversation-session.js';
import type { SessionWorkEdge, SessionWorkEdgeClose, SessionWorkIO } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import type { SessionIO, SessionJournal } from '../../src/assembly/production-session-driver.js';

function fixture(options: Partial<Pick<ConversationSessionConfig, 'maxCalls' | 'maxSteps' | 'maxResultBytes'>> = {}) {
  const f = assemblyRuntimeFixture();
  let clock = 1000, stopped = false, calls: number | null = 0, refused = false;
  let answer: string | null = '{"answer":"hello"}', phase = 'output-observed' as 'output-observed' | 'launched' | 'exit-observed';
  let releaseOK = true, stopOK = true, resultPath = '', launched = 0, stoppedCount = 0, released = 0;
  let resolveInput!: (id: string, hash: string) => string;
  const files = new Map<string, string>();
  const rows: (SessionWorkEdge | SessionWorkEdgeClose)[] = [], delivered: string[] = [], identities: string[] = [];
  const opened: string[] = [], closed: string[] = [];
  let admit: ConversationSessionConfig['resources']['admit'] = async () => ({ attach: async () => {},
    release: async () => { released++; return releaseOK; } });
  const io: SessionWorkIO = {
    clearResult: path => { files.delete(path); resultPath = path; }, readResult: path => files.get(path) ?? null,
    modelCalls: () => calls, wait: async ms => { clock += ms; },
    prepareAdmission: claim => { opened.push(claim); }, closeAdmission: claim => { closed.push(claim); },
    admissionState: () => ({ refused, openDelegations: [] }),
  };
  const config: ConversationSessionConfig = {
    conversation: 'operator-1', createDriver: resolve => {
      resolveInput = resolve;
      return { owner: 'part-eight', launch: () => { expect(rows[0]?.type).toBe('SessionWorkEdge'); launched++; return f.success('session:8:9'); },
        deliver: input => { identities.push(input.processIdentity); delivered.push(resolveInput(input.intake, input.digest));
          if (calls !== null) calls++;
          if (answer !== null) files.set(resultPath, answer);
          return f.success(`delivered:${input.operation}`); },
        observe: () => f.success({ phase, evidence: 'turn-close', detail: phase }),
        stop: () => { stoppedCount++; return stopOK ? f.success(['session']) : { kind: 'Refused' } as never; } };
    }, io, context: f.c, now: () => clock, stopped: () => stopped,
    resources: { admit: () => admit() },
    append: row => { rows.push(row); }, parent: 'run-1', owner: 'machine-1', placement: 'local', transport: 'tmux',
    workingScope: '/scope', resultDirectory: '/scope/results', artifact: 'artifact', incarnation: 'incarnation',
    deadlineMs: 2000, pollMs: 100, maxCalls: 3, maxSteps: 3, maxResultBytes: 65536, ...options,
  };
  const port = value(createConversationSessionPort(config));
  const request = (id: string, context = '{"memory":"tea","openCommitments":["bread"]}') => ({ operation: id,
    question: 'What do you remember?', context, authority: 'existing-role' });
  return { port, config, io, rows, delivered, opened, closed, identities, request,
    counts: () => ({ launched, stoppedCount, released }),
    calls: (n: number | null) => { calls = n; }, refuse: () => { refused = true; },
    stop: () => { stopped = true; }, advance: (ms: number) => { clock += ms; },
    answer: (text: string | null) => { answer = text; }, phase: (p: typeof phase) => { phase = p; },
    releaseFailure: () => { releaseOK = false; }, stopFailure: () => { stopOK = false; },
    setAdmission: (next: typeof admit) => { admit = next; },
  };
}

it('delivers both messages to one session, with fresh memory and one cumulative reservation', async () => {
  const f = fixture();
  expect(await f.port.run(f.request('message-1'))).toMatchObject({ state: 'complete', text: '{"answer":"hello"}' });
  f.answer('{"answer":"Tuesday"}');
  expect(await f.port.run(f.request('message-2', '{"correctedDay":"Tuesday","openCommitments":[]}')))
    .toMatchObject({ state: 'complete', text: '{"answer":"Tuesday"}' });
  expect(f.identities).toEqual(['session:8:9', 'session:8:9']);
  expect(f.counts()).toEqual({ launched: 1, stoppedCount: 0, released: 0 });
  expect(f.opened).toHaveLength(1); expect(f.closed).toHaveLength(0);
  expect(f.rows).toHaveLength(1); expect((f.rows[0] as SessionWorkEdge).budget.calls).toBe(3);
  expect(f.delivered[0]).toContain('"openCommitments":["bread"]');
  expect(f.delivered[1]).toContain('"correctedDay":"Tuesday"');
  expect(f.delivered[1]).not.toContain('You have no tools');
  expect(await f.port.close()).toMatchObject({ state: 'complete', calls: 2, reserved: 3 });
  expect(f.counts()).toEqual({ launched: 1, stoppedCount: 1, released: 1 });
  await f.port.close(); expect(f.rows).toHaveLength(2);
});

it('does not deliver the same operation twice or accept overlapping turns', async () => {
  const f = fixture();
  const first = f.port.run(f.request('one'));
  await expect(f.port.run(f.request('two'))).rejects.toThrow(/busy/);
  await first;
  await expect(f.port.run(f.request('one'))).rejects.toThrow(/already attempted/);
  expect(f.identities).toHaveLength(1); await f.port.close();
});

it('does not mistake a previous turn result for the next answer', async () => {
  const f = fixture();
  await f.port.run(f.request('one')); f.answer(null);
  expect(await f.port.run(f.request('two'))).toMatchObject({ state: 'uncertain', detail: 'conversation deadline exceeded' });
  expect(f.counts().released).toBe(1);
});

it('requires a closed turn even when the result file has stopped changing', async () => {
  const f = fixture(); f.phase('launched');
  expect(await f.port.run(f.request('one'))).toMatchObject({ state: 'uncertain', detail: 'conversation deadline exceeded' });
});

it.each(['unknown', 'over', 'refused'] as const)('retains the call floor on %s accounting', async mode => {
  const f = fixture(); await f.port.run(f.request('one'));
  if (mode === 'unknown') f.calls(null);
  if (mode === 'over') f.calls(3);
  if (mode === 'refused') f.refuse();
  expect(await f.port.run(f.request('two'))).toMatchObject({ state: 'uncertain' });
  expect(f.counts().launched).toBe(1); expect(f.closed).toHaveLength(1);
  expect(f.port.available()).toBe(false);
});

it('does not launch on stop and closes an existing session when stop arrives in a turn', async () => {
  const before = fixture(); before.stop();
  await expect(before.port.run(before.request('one'))).rejects.toThrow(/stop/);
  expect(before.counts().launched).toBe(0);
  const during = fixture();
  during.io.wait = async () => { during.stop(); };
  expect(await during.port.run(during.request('one'))).toMatchObject({ state: 'uncertain' });
  expect(during.counts()).toEqual({ launched: 1, stoppedCount: 1, released: 1 });
});

it('waits for pending resource admission before cleanup during close', async () => {
  const f = fixture();
  let admit!: (lease: Awaited<ReturnType<typeof f.config.resources.admit>>) => void;
  let releases = 0;
  f.setAdmission(() => new Promise(resolve => { admit = resolve; }));
  const pending = f.port.run(f.request('one'));
  const close = f.port.close();
  admit({ attach: async () => {}, release: async () => { releases++; return true; } });
  expect(await pending).toMatchObject({ state: 'uncertain' });
  expect(await close).toMatchObject({ state: 'uncertain' });
  expect(releases).toBe(1); expect(f.counts().launched).toBe(0);
});

it.each(['stop', 'lease'] as const)('retains uncertain closure when %s cleanup fails', async failure => {
  const f = fixture(); await f.port.run(f.request('one'));
  if (failure === 'stop') f.stopFailure(); else f.releaseFailure();
  expect(await f.port.close()).toMatchObject({ state: 'uncertain' });
  expect(f.closed).toHaveLength(1);
});

it('keeps exact authority, turn, result-size and wall-clock bounds', async () => {
  const a = fixture(); await a.port.run(a.request('one'));
  expect(await a.port.run({ ...a.request('two'), authority: 'changed' })).toMatchObject({ state: 'uncertain' });
  expect(a.identities).toHaveLength(1);
  const b = fixture({ maxSteps: 1 }); await b.port.run(b.request('one'));
  await expect(b.port.run(b.request('two'))).rejects.toThrow(/ceiling/); await b.port.close();
  const c = fixture({ maxResultBytes: 2 });
  expect(await c.port.run(c.request('one'))).toMatchObject({ state: 'uncertain', detail: 'conversation result exceeds byte bound' });
  const d = fixture(); await d.port.run(d.request('one')); d.advance(2000);
  await expect(d.port.run(d.request('two'))).rejects.toThrow(/deadline/); await d.port.close();
});

it('keeps the host as the sender and does not tell a continuing session it has no tools', () => {
  const text = conversationSessionPrompt({ question: 'Look this up', context: '{"accounts":[]}' }, '/scope/result');
  expect(text).toContain('Do not send to the operator yourself');
  expect(text).toContain('"accounts":[]'); expect(text).toContain('wait for the next message');
  expect(text).not.toContain('You have no tools');
});

it('uses the real admitted driver for two turns, preserving its durable delivery records and launch gates', async () => {
  const f = fixture();
  let journal: SessionJournal = { sessions: [], deliveries: [], resumes: {} };
  let live = false, pane = '❯ ', now = 1000, target = '', resultPath = '', entered = 0;
  const files = new Map<string, string>();
  const calls: string[][] = [];
  const physical: SessionIO = {
    exclusive: run => run(), load: () => journal, save: next => { journal = structuredClone(next); },
    sleep: ms => { now += ms; }, armDeadline: () => {}, transcriptExists: () => false, readInbox: () => [],
    tmux: args => {
      calls.push([...args]);
      if (args[0] === 'new-session') { live = true; target = `=${args[args.indexOf('-s') + 1]}:`; }
      if (args[0] === 'has-session') return { code: live && args[2] === target ? 0 : 1, stdout: '' };
      if (args[0] === 'display-message') return { code: 0, stdout: '321:1000\n' };
      if (args[0] === 'capture-pane') return { code: 0, stdout: pane };
      if (args[0] === 'kill-session') live = false;
      if (args[0] === 'send-keys' && args.includes('Enter')) {
        entered++; pane = `answer ${entered}\n❯ `;
        files.set(resultPath, JSON.stringify({ answer: `reply ${entered}` }));
      }
      return { code: 0, stdout: '' };
    },
  };
  const port = value(createConversationSessionPort({ ...f.config, now: () => now,
    io: { ...f.io, clearResult: path => { resultPath = path; files.delete(path); },
      readResult: path => files.get(path) ?? null, modelCalls: () => entered, wait: async ms => { now += ms; } },
    createDriver: resolveIntake => createProductionSessionDriver({ operatorOwnUse: true, confinement: 'admitted',
      framework: 'claude-code', executable: '/synthetic', cwd: '/scope', home: '/home/harness', configHome: '/home/harness',
      context: f.config.context, io: physical, now: () => now, stopped: () => false, resolveIntake,
      maxSessions: 1, turnDeadlineMs: 2000, readyTimeoutMs: 1000, protectedSessions: [],
      toolAdmission: { command: () => '/host/admitted-tool-hook', timeoutSeconds: 2 },
      modelGate: claim => `http://127.0.0.1:1234/${'a'.repeat(32)}/${claim}` }),
  }));
  expect(await port.run(f.request('first'))).toMatchObject({ state: 'complete', text: '{"answer":"reply 1"}' });
  expect(await port.run(f.request('second'))).toMatchObject({ state: 'complete', text: '{"answer":"reply 2"}' });
  expect(journal.sessions).toHaveLength(1);
  expect(journal.deliveries.map(row => [row.operation, row.state])).toEqual([['first', 'accepted'], ['second', 'accepted']]);
  expect(new Set(journal.deliveries.map(row => row.identity)).size).toBe(1);
  const launches = calls.filter(args => args[0] === 'new-session');
  expect(launches).toHaveLength(1);
  expect(launches[0]!.join(' ')).toContain('/host/admitted-tool-hook');
  expect(launches[0]!.join(' ')).toContain('ANTHROPIC_BASE_URL=http://127.0.0.1:1234/');
  expect(launches[0]!.join(' ')).not.toContain('MAX_THINKING_TOKENS=0');
  await port.close(); expect(live).toBe(false);
});

it('refuses unbounded or escaped configuration and accepts its bounded neighbors', () => {
  const f = fixture();
  expect(createConversationSessionPort(f.config).kind).toBe('Success');
  for (const patch of [{ maxCalls: 0 }, { maxCalls: 257 }, { maxSteps: 0 }, { maxSteps: 65 },
    { pollMs: 0 }, { pollMs: 5001 }, { deadlineMs: 0 }, { deadlineMs: 3600001 },
    { maxResultBytes: 0 }, { maxResultBytes: 1048577 }, { resultDirectory: '/scope/../elsewhere' },
    { resultDirectory: '/outside' }, { conversation: '../escape' }, { owner: ' ' },
    { resources: undefined as never }]) expect(createConversationSessionPort({ ...f.config, ...patch }).kind).toBe('Refused');
});

it('reconnects only between completed turns without a second admission or replaying the first input', async () => {
  const f = fixture();
  let alive = true, launches = 0;
  const create = f.config.createDriver;
  const port = value(createConversationSessionPort({ ...f.config, createDriver: resolve => {
    const driver = create(resolve);
    return { ...driver, launch: input => { launches++; alive = true; return driver.launch(input); },
      observe: () => alive ? driver.observe({ operation: 'observe', processIdentity: 'session:8:9' })
        : { kind: 'Success', value: { phase: 'exit-observed', evidence: 'dead', detail: 'exited' } } as never };
  } }));
  expect((await port.run(f.request('first'))).state).toBe('complete');
  alive = false;
  expect((await port.run(f.request('second'))).state).toBe('complete');
  expect(launches).toBe(2); expect(f.opened).toHaveLength(1); expect(f.delivered).toHaveLength(2);
  expect(f.rows.filter(row => row.type === 'SessionWorkEdge')).toHaveLength(1);
  await port.close();
});

it('the host work tick releases an idle session at its deadline without a new message', async () => {
  const f = fixture();
  await f.port.run(f.request('message-1'));
  await f.port.maintain();
  expect(f.counts().stoppedCount).toBe(0);
  f.advance(2000);
  await f.port.maintain();
  expect(f.counts()).toEqual({ launched: 1, stoppedCount: 1, released: 1 });
  expect(f.port.available()).toBe(false);
});
