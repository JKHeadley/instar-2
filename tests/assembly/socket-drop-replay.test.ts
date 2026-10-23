import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import type { SessionIO, SessionJournal } from '../../src/assembly/production-session-driver.js';
import { createSessionConversationAdapter } from '../../src/assembly/conversation-harness-adapter.js';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import type { ConversationState, ConversationSessionConfig, ConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value } from '../facts/fixtures.js';
// @ts-expect-error Host-only JavaScript projection used by the shipped launcher.
import { createWorkingActivities } from '../preview/working-activity.mjs';

const capture = JSON.parse(readFileSync(new URL('../preview/fixtures/socket-drop-worker-1016101-2026-10-16.json', import.meta.url), 'utf8'));
const persistent = capture.runs[1];
const frames: { at: number; stdout: string }[] = [...persistent.panes.filter((frame: { stdout: string }) => /Retrying in/.test(frame.stdout)), persistent.panes.at(-1)];
const errors: { at: number }[] = persistent.errors;
const shapes: { kind: string; id: string; raw: string }[] = JSON.parse(readFileSync(new URL('../preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;

/** Real captured terminal frames through the real driver, public adapter and owner.
 * Only physical I/O and time are substituted. Retry timestamps and call counts are captured. */
function replay(result: string | null, stopAtRetry = false) {
  const f = assemblyRuntimeFixture();
  let now = frames[0]!.at - 1000, index = -1, live = false, enters = 0, stopped = false, charged = 0;
  let state: ConversationState | null = null, path = '', currentResult: string | null = null;
  let journal: SessionJournal = { sessions: [], deliveries: [], resumes: {} };
  const receipts: { kind: 'turn-closed'; sessionId: string; at: number; receiptId: string }[] = [];
  const physical: SessionIO = {
    exclusive: run => run(), load: () => journal, save: next => { journal = structuredClone(next); },
    sleep: ms => { now += ms; }, armDeadline: () => {}, transcriptExists: () => false, readInbox: () => receipts,
    tmux: args => {
      if (args[0] === 'new-session') live = true;
      if (args[0] === 'has-session') return { code: live ? 0 : 1, stdout: '' };
      if (args[0] === 'display-message') return { code: 0, stdout: '321:1000' };
      if (args[0] === 'capture-pane') return { code: 0, stdout: index < 0 ? '❯ ' : frames[index]!.stdout };
      if (args[0] === 'kill-session') live = false;
      if (args[0] === 'send-keys' && args.includes('Enter')) { enters++; index = 0; now = frames[0]!.at; charge(); }
      return { code: 0, stdout: '' };
    },
  };
  const activities = createWorkingActivities({ now: () => now, read: () => '' });
  const waits: { step: string; wait: string }[] = [];
  let port: ConversationSessionPort;
  const charge = () => {
    while (charged < errors.length && errors[charged]!.at <= now) {
      port.reserveCall(state!.claim!, charged + 1); charged++;
    }
  };
  const config: ConversationSessionConfig = {
    workingActivity: (operation, claim, phase) => {
      activities.observe(operation, claim, phase);
      const activity = activities.current(operation);
      if (activity?.wait) waits.push(activity);
    },
    conversation: 'socket-proof', allowanceDeadline: now + 900000, authorized: () => true, currentAuthority: () => 'role',
    store: { load: () => structuredClone(state), save: next => { state = structuredClone(next); } },
    io: { clearResult: next => { path = next; currentResult = null; }, readResult: file => file === path ? currentResult : null,
      modelCalls: () => charged, wait: async () => {
        if (stopAtRetry) stopped = true;
        index = Math.min(index + 1, frames.length - 1); now = frames[index]!.at; charge();
        if (result !== null && index === frames.length - 1) {
          currentResult = result;
          receipts.push({ kind: 'turn-closed', sessionId: '12345678-1234-1234-1234-123456789abc', at: now, receiptId: 'recorded-turn-end' });
        }
      }, prepareAdmission: () => {}, closeAdmission: () => {}, admissionState: () => ({ refused: false, openDelegations: [] }) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: f.c, now: () => now, stopped: () => stopped, append: () => {},
    parent: 'run', owner: 'machine', placement: 'local', transport: 'loopback-replay', workingScope: '/scope',
    resultDirectory: '/scope/results', artifact: 'artifact', incarnation: 'incarnation',
    deadlineMs: 600000, pollMs: 100, maxCalls: 128, maxSteps: 3, maxResultBytes: 65536,
    createAdapter: resolveDelivery => createSessionConversationAdapter({ io: config.io, resolveDelivery,
      createDriver: resolveIntake => { const driver = createProductionSessionDriver({ operatorOwnUse: true, confinement: 'admitted', framework: 'claude-code',
        executable: '/fake', cwd: '/scope', home: '/h', configHome: '/h', context: f.c, io: physical, now: () => now,
        stopped: () => stopped, resolveIntake, maxSessions: 1, turnDeadlineMs: 600000, readyTimeoutMs: 1000,
        protectedSessions: [], requireTurnHook: true, hookScript: '/installed/stop.mjs', inboxDirectory: '/inbox',
        toolAdmission: { command: () => '/installed/tool-hook', timeoutSeconds: 2 },
        modelGate: claim => `http://127.0.0.1:1234/${'a'.repeat(32)}/${claim}` });
        return { ...driver, observe: input => {
          const observed = driver.observe(input);
          activities.observeSession(journal.sessions.find(row => row.identity === input.processIdentity), observed);
          return observed;
        } };
      } }),
  };
  port = value(createConversationSessionPort(config));
  return { port, config, waits, activities, state: () => state!, journal: () => journal, enters: () => enters, charged: () => charged,
    request: { operation: 'recorded-update-1016102', question: 'Retain my original request', context: '{}', authority: 'role' } };
}

it('exhaustion reaches the existing owner once, retaining input and uncertainty without redelivery', async () => {
  const f = replay(null), outcome = await f.port.run(f.request);
  expect(outcome.state).toBe('uncertain');
  expect(f.state().inputs[0]!.request).toEqual(f.request);
  expect(f.state().spent).toBe(errors.length);
  expect(f.journal().sessions[0]!.connectionRetry?.attempt).toBe(10);
  expect(f.journal().sessions[0]!.turnCloseEvidence).toBeNull();
  expect(await f.port.run(f.request)).toEqual(outcome);
  const restarted = value(createConversationSessionPort(f.config));
  expect((await restarted.collect(f.request.operation))!.outcome).toEqual(outcome);
  expect(f.state().spent).toBe(errors.length); expect(f.enters()).toBe(1);
  await restarted.close();
});

it('stops during native backoff without another owner input or fabricated success', async () => {
  const f = replay(null, true);
  expect((await f.port.run(f.request)).state).toBe('uncertain');
  expect(f.enters()).toBe(1); expect(f.charged()).toBeLessThan(errors.length); await f.port.close();
});

it.each(shapes)('preserves the recorded $kind ($id) at a correlated close after retry', async shape => {
  const f = replay(shape.raw), result = await f.port.run(f.request);
  expect(result.state).toBe(shape.raw ? 'complete' : 'uncertain');
  if (shape.raw) expect(result).toMatchObject({ text: shape.raw });
  expect(f.enters()).toBe(1); expect(f.state().spent).toBe(errors.length);
  expect(f.state().inputs[0]!.request).toEqual(f.request);
  await f.port.close();
});

it('retains recorded retry spacing and the baseline missing-close defect as evidence', () => {
  expect(errors).toHaveLength(12);
  expect(errors[6]!.at - errors[5]!.at).toBeGreaterThan(8000);
  expect(errors[10]!.at - errors[9]!.at).toBeGreaterThan(30000);
  expect(persistent.owner.inputs[0].state).toBe('accepted');
  expect(persistent.owner.inputs[0].outcome).toBeNull();
  expect(persistent.sends).toEqual([]);
  expect(capture.runs[0].owner.inputs[0].outcome.state).toBe('complete');
  expect(capture.runs[0].sends).toHaveLength(1);
});

it.each(shapes)('exhaustion retains recorded $kind ($id) input without rewriting or replaying it', async shape => {
  const f = replay(null), request = { ...f.request, context: shape.raw };
  expect((await f.port.run(request)).state).toBe('uncertain');
  expect(f.state().inputs[0]!.request).toEqual(request);
  expect(f.journal().sessions[0]!.connectionRetry?.attempt).toBe(10);
  expect(f.enters()).toBe(1); await f.port.close();
});

it('records the final unattended exhaustion reaching one honest notice with the request retained', () => {
  const proof = capture.proofs.find((item: { name: string }) => item.name === 'persistent');
  expect(proof.update).toBe(1016105);
  expect(proof.owner.inputs[0].state).toBe('settled');
  expect(proof.owner.inputs[0].outcome.state).toBe('uncertain');
  expect(proof.owner.spent).toBe(12);
  expect(proof.sessionJournal.sessions[0].connectionRetry.attempt).toBe(10);
  expect(proof.sends).toHaveLength(1);
  expect(proof.sends[0].text).toBe('The answer-writing step did not complete. Your request and this incomplete attempt remain in the conversation record.');
  expect(proof.journal.filter((row: { kind: string }) => row.kind === 'sent')).toHaveLength(1);
});

it('records transient native recovery to one correlated answer and one delivered result', () => {
  const proof = capture.proofs.find((item: { name: string }) => item.name === 'transient');
  expect(proof.update).toBe(1016106);
  expect(proof.owner.inputs[0].outcome.state).toBe('complete');
  expect(proof.owner.spent).toBe(3);
  expect(proof.sessionJournal.sessions[0].turnCloseEvidence).toMatch(/^turn-closed:/);
  expect(proof.sessionJournal.deliveries).toHaveLength(1);
  expect(proof.sends).toHaveLength(1); expect(proof.sends[0].text).toMatch(/^51\b/);
});


it('projects the real retry frames through the shipped adapter and owner as one bounded wait episode', async () => {
  const f = replay(null);
  expect((await f.port.run(f.request)).state).toBe('uncertain');
  expect(f.waits.length).toBeGreaterThan(1);
  expect(f.waits.every(row => row.wait === 'connection')).toBe(true);
  expect(new Set(f.waits.map(row => row.step)).size).toBe(1);
  expect(f.activities.current(f.request.operation)).toBeNull();
  expect(f.enters()).toBe(1); expect(f.charged()).toBe(errors.length);
  await f.port.close();
});
