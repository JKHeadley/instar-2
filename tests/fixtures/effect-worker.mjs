import { appendFileSync, closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../dist/index.js';
import { createEffectSlice } from '../../scripts/effect-slice.mjs';

const [seedPath, directory, mode, cut] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
const journal = (name, value) => {
  const fd = openSync(join(directory, name), 'a', 0o600);
  try { appendFileSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
};
const pause = operation => {
  writeSync(1, JSON.stringify({ ready: true, operation, cut }) + '\n');
  process.kill(process.pid, 'SIGSTOP');
  throw new Error('fault worker must be killed, never resumed');
};
const slice = createEffectSlice(seed, directory, {
  incarnation: mode === 'start' ? 'child:1' : 'child:2', authorityIncarnation: mode === 'start' ? 'authority:1' : 'authority:2',
  monotonic: () => mode === 'start' ? 100 : 110,
  adapter: result => ({ owner: 'part-ten', id: 'telegram-fixture',
    describe: () => ({ contract: 'fixture-contract:1', account: 'bot:fixture', conversation: 'chat:fixture', maxCharge: 20, timeout: 100, hiddenRetries: 0 }),
    invoke: input => result(() => {
      if (cut === 'before-send') pause(input.operation);
      journal('external-service.jsonl', { operation: input.operation, claim: input.claim, digest: input.digest, message: input.message });
      if (cut === 'after-send') pause(input.operation);
      return JSON.stringify({ ok: true, result: { message_id: 1, chat: { id: input.message.conversation }, text: input.message.text } });
    }),
    observe: input => result(() => { journal('queries.jsonl', input); return JSON.stringify({ status: 'unknown', reason: 'no authoritative negative lookup' }); }),
  }),
});
if (mode === 'start') {
  const { request, fence } = slice.initialize();
  const observation = take(slice.api.dispatch(request, fence));
  pause(observation.operation);
} else {
  const all = take(slice.transport.inspect());
  const fence = take(slice.transport.acquire('takeover', all.at(-1).fact.id, 500));
  const op = all.filter(v => v.record.type === 'AdmissionReservation').at(-1).record;
  const recovery = take(slice.transport.recover('observe', fence, op.operation, slice.api));
  const replay = slice.transport.claim('new-claim', fence, op.operation);
  const fresh = slice.transport.reserve({ command: 'fresh-key', fence, request: { owner: 'part-eight', name: 'EffectRequest', id: 'fresh-request' },
    attempt: 'fresh-attempt', payloadDigest: op.digest, charge: 20, run: { owner: 'part-five', name: 'Run', id: 'fresh-run' },
    semanticMessage: op.semanticMessage, durability: 'replicated', replicas: 1 });
  const isRefused = r => consumeResult(r, { Success: () => false, Refused: () => true });
  writeSync(1, JSON.stringify({ recovery, replayRefused: isRefused(replay), freshRefused: isRefused(fresh),
    operation: op.operation, charge: op.charge, records: take(slice.api.inspect()).map(v => v.record) }) + '\n');
}
