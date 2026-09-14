import { publicKey } from '../../facts/fixtures.js';
import {
  got, m, measurementA2Fixture as F, no, ok, one, privateKey, proj, request,
} from '../a2-round4-review/common.js';
import type { Round6Case } from './new-cases.js';

const cases: Round6Case[] = [];
function test(name: string, run: () => unknown, accept: (result: any) => boolean): void {
  try {
    const actual = run();
    cases.push({ name, pass: accept(actual), actual });
  } catch (error) {
    cases.push({ name, pass: false, exception: String(error) });
  }
}

const f = F();
const observation = f.planObservation({ subject: 'checkpoint', sourceEvent: 'checkpoint:e',
  amount: 97, at: 100, contract: f.eventProducer });
f.persistObservation(observation);
const history = f.snapshot();
const read = request(f, history, [f.eventProducer]);
const view = got(proj.foldProjection(read.sourceDefinition, history, read.sourceGeneration, f.c));
const checkpoint = proj.checkpoint(view);
const certificate = proj.signCheckpoint(checkpoint, 'review-cache', privateKey);
const keys = [{ id: 'review-cache', publicKey }];

test('checkpoint:valid-serialized-restore',
  () => proj.restoreCheckpoint(JSON.parse(JSON.stringify(certificate)), history, f.c, keys), ok);
const corrupt = JSON.parse(JSON.stringify(certificate));
corrupt.payload.value.checkpoint.view.values['measurement-observation:corrupt'] = '999';
test('checkpoint:tampered-amount-refused',
  () => proj.restoreCheckpoint(corrupt, history, f.c, keys), no);
test('checkpoint:untrusted-signer-refused',
  () => proj.restoreCheckpoint(certificate, history, f.c, []), no);
const restored = got(proj.restoreCheckpoint(certificate, history, f.c, keys));
test('checkpoint:restored-equals-genesis', () => proj.verifyRebuild(checkpoint,
  proj.checkpoint(got(proj.rebuildProjection(read.sourceDefinition, history,
    read.sourceGeneration, f.c, [restored])).view), f.c),
result => ok(result) && got(result) === 'equal');
test('projection:copied-view-refused', () => proj.readProjection(
  JSON.parse(JSON.stringify(view)), read.sourceDefinition, f.clock(200), f.c), no);
const before = got(m.renderCurrentMeasurementRead(read, f.c));
const cache = got(m.createBoundedReadCache(got(m.decodeReadCachePolicy(f.cachePolicyInput, f.c)), f.c));
got(cache.put({ key: 'corrupt-cache', bytes: 'wrong amount', byteLength: 12,
  createdAt: f.clock(100) }));
got(cache.applyEviction(['corrupt-cache']));
test('cache:drop-rebuild-equal', () => m.renderCurrentMeasurementRead(read, f.c),
  result => ok(result)
    && got(one.canonical(got(result))).bytes === got(one.canonical(before)).bytes);

const bindings = {
  'measurement-observation': {
    identity: 'identity', value: 'measurement', merge: 'set-union',
  },
};
test('definition:valid-kinds-control',
  () => m.measurementProjectionDefinition(read.sourceGeneration, bindings, f.c), ok);
test('definition:numeric-kind-refused', () => m.measurementProjectionDefinition({
  ...read.sourceGeneration, kinds: ['measurement-observation', 42],
}, bindings, f.c), no);

export const round6CheckpointCases = cases;
