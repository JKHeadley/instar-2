import { appendFileSync, closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../dist/index.js';
import { createEffectSlice } from '../../scripts/effect-slice.mjs';

// The admitted-dispatch SIGKILL fixture: six admits the operation EXTERNALLY, eight
// adopts + dispatches it, then the process is killed BETWEEN dispatch and settlement.
// A fresh process settles from the durable facts alone, producing the authentic
// EffectSettlement, without a second send, claim or reservation.
const [seedPath, directory, mode] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
const isRefused = r => consumeResult(r, { Success: () => false, Refused: () => true });
const journal = (name, value) => {
  const fd = openSync(join(directory, name), 'a', 0o600);
  try { appendFileSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
};
const pause = operation => {
  writeSync(1, JSON.stringify({ ready: true, operation }) + '\n');
  process.kill(process.pid, 'SIGSTOP');
  throw new Error('fault worker must be killed, never resumed');
};
const slice = createEffectSlice(seed, directory, {
  incarnation: mode === 'start' ? 'child:1' : 'child:2', authorityIncarnation: mode === 'start' ? 'authority:1' : 'authority:2',
  monotonic: () => mode === 'start' ? 100 : 110,
  assessment: { state: 'happened', charge: 3 },
  adapter: result => ({ owner: 'part-ten', id: 'telegram-fixture',
    describe: () => ({ contract: 'fixture-contract:1', account: 'bot:fixture', conversation: 'chat:fixture', maxCharge: 20, timeout: 100, hiddenRetries: 0 }),
    invoke: input => result(() => {
      journal('external-service.jsonl', { operation: input.operation, claim: input.claim, digest: input.digest, message: input.message });
      return JSON.stringify({ ok: true, result: { message_id: 1, chat: { id: input.message.conversation }, text: input.message.text } });
    }),
    observe: input => result(() => { journal('queries.jsonl', input); return JSON.stringify({ status: 'unknown', reason: 'no authoritative negative lookup' }); }),
  }),
});
if (mode === 'start') {
  // Admit externally, adopt, dispatch — then pause BEFORE any settlement.
  const { request, fence } = slice.initializeAdmitted();
  const observation = take(slice.api.dispatch(request, fence));
  pause(observation.operation);
} else {
  // A fresh process settles from the durable facts alone.
  const all = take(slice.transport.inspect());
  const op = all.filter(v => v.record.type === 'AdmissionReservation').at(-1).record;
  const fence = take(slice.transport.acquire('takeover', all.at(-1).fact.id, 500));
  const settlement = take(slice.api.settle(op.operation));
  // No replay: a fresh claim of the already-consumed operation refuses.
  const replay = slice.transport.claim('new-claim', fence, op.operation);
  writeSync(1, JSON.stringify({ operation: op.operation, settled: settlement.operation, charge: settlement.finalCharge,
    retainedExposure: settlement.retainedExposure, replayRefused: isRefused(replay),
    reservations: new Set(all.filter(v => v.record.type === 'AdmissionReservation').map(v => v.record.operation)).size }) + '\n');
}
