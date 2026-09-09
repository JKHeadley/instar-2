import { appendFileSync, closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../dist/index.js';
import { createEffectSlice } from '../../scripts/effect-slice.mjs';

const [seedPath, directory, mode, cut] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const take = result => consumeResult(result, { Success: value => value, Refused: refusal => { throw new Error(refusal.detail); } });
const isRefused = result => consumeResult(result, { Success: () => false, Refused: () => true });
const journal = value => {
  const fd = openSync(join(directory, 'aggregate-service.jsonl'), 'a', 0o600);
  try { appendFileSync(fd, `${JSON.stringify(value)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
};
const pause = (operation, aggregate) => {
  writeSync(1, `${JSON.stringify({ ready: true, operation, aggregate, cut })}\n`);
  process.kill(process.pid, 'SIGSTOP');
  throw new Error('fault worker must be killed, never resumed');
};
const slice = createEffectSlice(seed, directory, {
  incarnation: mode === 'start' ? 'aggregate:1' : 'aggregate:2',
  authorityIncarnation: mode === 'start' ? 'authority:1' : 'authority:2',
  monotonic: () => mode === 'start' ? 100 : 110,
  assessment: { state: 'happened', charge: 3 },
  adapter: result => ({ owner: 'part-ten', id: 'telegram-fixture',
    describe: () => ({ contract: 'fixture-contract:1', account: 'bot:fixture', conversation: 'chat:fixture', maxCharge: 20, timeout: 100, hiddenRetries: 0 }),
    invoke: input => result(() => { journal({ operation: input.operation, digest: input.digest }); return JSON.stringify({ ok: true }); }),
    observe: () => result(() => JSON.stringify({ status: 'unknown' })),
  }),
});

if (mode === 'start') {
  const { request, fence } = slice.initialize();
  const aggregate = take(slice.api.createAggregate({ semanticMessage: request.semanticMessage,
    run: { owner: 'part-five', name: 'Run', id: request.run },
    children: [{ request, demandedStage: 'occurrence', inhibitLater: true, required: true }], reconciliationOwner: 'restart-reconciler' }));
  const reservation = take(slice.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation').at(-1).record;
  if (cut === 'record') pause(reservation.operation, aggregate.aggregate);
  const observation = take(slice.api.dispatch(request, fence));
  if (cut === 'claim') pause(observation.operation, aggregate.aggregate);
  const settlement = take(slice.api.settle(observation.operation));
  if (cut === 'settle') pause(observation.operation, aggregate.aggregate);
  throw new Error(`unknown cut after settlement ${settlement.id}`);
} else {
  const transportRows = take(slice.transport.inspect());
  const fence = take(slice.transport.acquire('aggregate-takeover', transportRows.at(-1).fact.id, 500));
  const reservation = transportRows.filter(row => row.record.type === 'AdmissionReservation').at(-1).record;
  const effectRows = take(slice.api.inspect());
  const request = effectRows.find(row => row.record.type === 'EffectRequest').record;
  const aggregate = effectRows.find(row => row.record.type === 'OrderedEffectAggregate').record;
  let observation = effectRows.filter(row => row.record.type === 'OperationObservation' && row.record.operation === reservation.operation).at(-1)?.record;
  let dispatchRefusal;
  if (!observation) consumeResult(slice.api.dispatch(request, fence), { Success: value => { observation = value; }, Refused: value => { dispatchRefusal = value; } });
  let settlement, updated, replayRefused;
  if (dispatchRefusal) {
    updated = take(slice.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, refusal: dispatchRefusal }));
    replayRefused = isRefused(slice.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, refusal: dispatchRefusal }));
  } else {
    settlement = take(slice.api.inspect()).filter(row => row.record.type === 'EffectSettlement' && row.record.operation === reservation.operation).at(-1)?.record;
    if (!settlement) settlement = take(slice.api.settle(observation.operation));
    const update = slice.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, settlement });
    if (isRefused(update)) {
      // A settlement whose assessment/evidence was process-local remains durable
      // but cannot promote the parent after restart. Preserve the pending aggregate.
      updated = aggregate; replayRefused = true;
    } else {
      updated = take(update);
      replayRefused = isRefused(slice.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, settlement }));
    }
  }
  writeSync(1, `${JSON.stringify({ operation: reservation.operation, aggregate: updated.aggregate, state: updated.state,
    replayRefused, records: take(slice.api.inspect()).length })}\n`);
}
