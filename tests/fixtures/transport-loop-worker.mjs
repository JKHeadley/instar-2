import { readFileSync } from 'node:fs';
import { consumeResult, decodeMeasurement } from '../../dist/index.js';
import { decodeLoopPolicy } from '../../dist/transport/index.js';
import { createTransportSlice } from '../../scripts/transport-slice.mjs';

const [seedPath, directory, mode, rawNow] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const now = Number(rawNow);
const take = result => consumeResult(result, { Success: value => value, Refused: refusal => {
  throw new Error(`${refusal.site}: ${refusal.detail}`);
} });
const slice = createTransportSlice(seed, directory, { incarnation: `worker:${mode}`,
  authorityIncarnation: `authority:${mode}`, monotonic: () => now });
const clock = () => take(decodeMeasurement('clock', { ...seed.clock, value: now, at: now }, slice.host.current().decode));
Object.assign(slice.host, {
  loopClock: { owner: 'part-ten', now: clock },
  restorationEvidence: { owner: 'part-nine', verify: input => slice.result(() => input.reference) },
});
const { api } = slice;
const head = () => take(api.inspect()).at(-1)?.fact.id ?? '';
const latest = () => take(api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1).record;
const reference = loop => ({ owner: 'part-six', name: 'LoopRecord', id: loop.episode });
const token = take(api.acquire(`lease:${mode}`, head(), 500));
const vector = [{ machine: 'machine-a', epoch: 0, position: 1 }, { machine: 'machine-b', epoch: 0, position: 1 }];

if (mode === 'schedule') {
  const parentDuty = { owner: 'part-five', name: 'Run', id: 'run:e2e-parent' };
  const policy = take(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'policy:e2e-shared',
    maxAttempts: 8, minDelay: 1, maxDuration: 1000, timeout: 10, concurrency: 2,
    failDirection: 'closed', breaker: 'shared-circuit-v1', initialDelay: 1, maxDelay: 20,
    backoffMultiplier: 2, jitterMinPermille: 1000, jitterMaxPermille: 1000,
    failureThreshold: 2, countedFailureClasses: ['transport'], acceptedOutcomeWindow: 500,
    breakerCooldown: 20, maxOpenDuration: 200, halfOpenTrials: 2, halfOpenConcurrency: 1,
    closeEvidence: 'part-nine-restoration', reopenEvidence: 'counted-failure', parentDuty,
    budgetWindow: 500, parentAttemptBudget: 8, parentResourceBudget: 20 }, slice.c));
  take(api.scheduleEpisode({ command: 'episode:e2e', fence: token,
    currentOwnerRun: { owner: 'part-five', name: 'Run', id: 'run:e2e-owner' }, policy,
    episodeKey: 'episode:e2e', operationFamily: 'recovery-holder',
    pressureScope: { target: 'shared', conversation: seed.domain, machine: 'fleet', pool: 'holders' }, sourceVector: vector }));
} else if (mode === 'admit') {
  const loop = latest();
  take(api.admitLoopAttempt({ command: 'attempt:e2e-a', fence: token, episode: reference(loop), attempt: 'e2e-a',
    holderFamily: 'sentinel', worker: 'worker-a', machine: 'machine-a', resource: 1, sourceVector: vector }));
} else if (mode === 'fail-first') {
  const loop = latest();
  take(api.recordLoopOutcome({ command: 'outcome:e2e-a', fence: token, episode: reference(loop), attempt: 'e2e-a',
    kind: 'failed', failureClass: 'transport', jitterPermille: 1000, restoration: [], sourceVector: vector }));
} else if (mode === 'open') {
  let loop = latest();
  loop = take(api.admitLoopAttempt({ command: 'attempt:e2e-b', fence: token, episode: reference(loop), attempt: 'e2e-b',
    holderFamily: 'watchdog', worker: 'worker-b', machine: 'machine-b', resource: 1, sourceVector: vector }));
  take(api.recordLoopOutcome({ command: 'outcome:e2e-b', fence: token, episode: reference(loop), attempt: 'e2e-b',
    kind: 'failed', failureClass: 'transport', jitterPermille: 1000, restoration: [], sourceVector: vector }));
} else if (mode === 'half-open') {
  const loop = latest();
  take(api.admitLoopAttempt({ command: 'attempt:e2e-trial', fence: token, episode: reference(loop), attempt: 'e2e-trial',
    holderFamily: 'sentinel', worker: 'worker-c', machine: 'machine-b', resource: 1, sourceVector: vector }));
} else if (mode !== 'inspect') throw new Error(`unknown mode ${mode}`);

const loop = latest();
process.stdout.write(JSON.stringify({ state: loop.state, transition: loop.transition, attempts: loop.attempts,
  totalFailures: loop.totalFailures, pendingAttempts: loop.pendingAttempts, pressureKey: loop.pressureKey }) + '\n');
