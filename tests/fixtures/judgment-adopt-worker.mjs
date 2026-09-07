import { appendFileSync, closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../dist/index.js';
import { createJudgmentSlice } from '../../scripts/judgment-slice.mjs';

// The through-eight adopted-dispatch SIGKILL fixture (docs/11 step 6): seven
// reserves via six, hands the admitted dispatch to eight, and is killed BETWEEN
// durable steps. A fresh PROCESS restores the same logical worker incarnation
// (seven's stale-incarnation gate refuses a foreign worker by design) and
// completes through the public seams: at most ONE provider invocation total,
// then eight's settlement resolves the operation through six and the run
// admits a SECOND operation.
const [seedPath, directory, mode, cut] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
const out = v => writeSync(1, JSON.stringify(v) + '\n');
const journal = (name, value) => { const fd = openSync(join(directory, name), 'a', 0o600);
  try { appendFileSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd); } finally { closeSync(fd); } };
const pause = phase => { out({ ready: true, phase }); process.kill(process.pid, 'SIGSTOP');
  throw new Error('fault worker must be killed, never resumed'); };
const runtime = { incarnation: 'worker:1', authorityIncarnation: 'authority:1',
  monotonic: () => mode === 'start' ? 100 : 110,
  invoke: async () => { throw new Error('direct model exchange must not be used in the adopted composition'); },
  effectsInvoke: input => journal('provider-invocations.jsonl', { operation: input.operation, digest: input.digest }),
  wrapEffects: port => mode !== 'start' ? port : ({ ...port,
    adopt: input => { if (cut === 'reserve') pause('reserve'); return port.adopt(input); },
    dispatch: (adopted, fence) => {
      if (cut === 'adopt') pause('adopt');
      const observation = port.dispatch(adopted, fence);
      if (cut === 'dispatch') { take(observation); pause('dispatch'); }
      return observation;
    } }),
};
const slice = createJudgmentSlice(seed, directory, runtime);
const all = take(slice.six.inspect());
// The restarted worker RESUMES its held lease (same logical incarnation): a
// duplicate acquire with the original command/predecessor/term re-derives the
// original fence. Six's fence rules bind the reservation to that exact fence.
const prior = all.find(v => v.record.type === 'Lease' && v.record.command === 'acquire:start');
const fence = prior ? take(slice.six.acquire('acquire:start', prior.record.predecessor, prior.record.term))
  : take(slice.six.acquire('acquire:start', all.at(-1)?.fact.id ?? '', 150));
if (!all.some(v => v.record.type === 'LoopRecord')) take(slice.six.schedule('schedule:start', fence, seed.question.run, seed.policy));
const answer = take(await slice.doorway.judge(seed.question, fence));
if (mode === 'start') out({ recorded: !!answer.decision, phase: 'none' });
else {
  // Eight settles from its own evidence-checked path; six consumes the authentic
  // issuance; the same run then admits its second (outbound-shaped) operation.
  const consumed = take(slice.six.inspect()).find(v => v.record.type === 'AdmissionReservation' && v.record.state === 'consumed');
  const settlement = take(slice.effectDoorway.settle(consumed.record.operation));
  const applied = take(slice.six.settle(fence, settlement));
  const second = take(slice.six.reserve({ command: 'outbound-after-judgment', fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'outbound-request:1' }, attempt: 'outbound-attempt:1',
    payloadDigest: `sha256:${'b'.repeat(64)}`, charge: 20, run: seed.question.run, semanticMessage: 'five-owned:outbound-reply:1',
    durability: 'local-durable', replicas: 0 }));
  const modelOperations = new Set(take(slice.six.inspect()).filter(v => v.record.type === 'AdmissionReservation'
    && v.record.semanticMessage === seed.question.semanticMessage).map(v => v.record.operation));
  out({ recorded: !!answer.decision, unresolved: applied.unresolved, exposure: applied.exposure,
    secondAdmitted: second.state === 'prepared', modelOperations: modelOperations.size });
}
