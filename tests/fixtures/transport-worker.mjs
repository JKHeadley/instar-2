import { appendFileSync, closeSync, fsyncSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../dist/index.js';
import { decodeLoopPolicy, telegramReferenceAdapter } from '../../dist/transport/index.js';
import { createTransportSlice } from '../../scripts/transport-slice.mjs';

// TEST ONLY eight-owned doorway/observer stand-in. No Telegram conformance claim.
const [seedPath, directory, mode, cut] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
const out = value => process.stdout.write(JSON.stringify(value) + '\n');
const journal = (name, value) => {
  const fd = openSync(join(directory, name), 'a', 0o600);
  try { appendFileSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
};
const now = mode === 'start' ? 100 : 120;
const slice = createTransportSlice(seed, directory, { incarnation: mode === 'start' ? 'worker:1' : 'worker:2',
  authorityIncarnation: mode === 'start' ? 'authority:1' : 'authority:2', monotonic: () => now });
const { api, result } = slice;
const head = () => take(api.inspect()).at(-1)?.fact.id ?? '';
if (mode === 'start') {
  const token = take(api.acquire('acquire', head(), 500));
  const policy = take(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'loop:policy', maxAttempts: 3,
    minDelay: 10, maxDuration: 100, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, slice.c));
  const run = { owner: 'part-five', name: 'Run', id: 'run:1' };
  take(api.schedule('schedule', token, run, policy));
  const reservation = take(api.reserve({ command: 'reserve', fence: token,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'effect:1' }, attempt: 'attempt:1',
    payloadDigest: `sha256:${'a'.repeat(64)}`, charge: 20, run, semanticMessage: 'five:semantic-message', durability: 'local-durable', replicas: 0 }));
  const claim = take(api.claim('claim', token, reservation.operation));
  if (cut !== 'claim') {
    const doorway = { owner: 'part-eight', send: input => result(() => {
      take(api.consume(input.claim, input.fence));
      if (cut === 'send') journal('external-effects.jsonl', { operation: input.reservation.operation, message: input.message });
      return 'fixture-receipt';
    }) };
    take(telegramReferenceAdapter(doorway).dispatch({ semanticId: reservation.semanticMessage, text: 'reference reply' }, reservation, claim, token));
  }
  out({ ready: true, cut, operation: reservation.operation });
  setInterval(() => {}, 1000); // Test parent SIGKILLs the real process at the acknowledged cut.
} else {
  const token = take(api.acquire('takeover', head(), 500));
  const unresolved = take(api.inspect()).map(r => r.record).filter(r => r.type === 'AdmissionReservation').at(-1);
  const recovery = take(api.recover('recover', token, unresolved.operation, { owner: 'part-eight',
    observe: operation => result(() => {
      journal('observations.jsonl', { operation, method: 'read-only-lookup' });
      return { owner: 'part-eight', name: 'EffectObservation', id: `unknown:${operation}` };
    }),
  }));
  const replay = api.claim('repeat', token, unresolved.operation);
  const replayRefused = consumeResult(replay, { Success: () => false, Refused: () => true });
  out({ recovery, replayRefused, records: take(api.inspect()).map(r => r.record) });
}
