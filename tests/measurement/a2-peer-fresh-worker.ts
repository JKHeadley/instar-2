import {
  currentPeerHistoryBinding, mergeCurrentPeerMeasurements,
} from '../../src/measurement/index.js';
import { value } from '../facts/fixtures.js';
import { measurementA2Fixture } from './a2-fixture.js';

const f = measurementA2Fixture();
const observation = f.planObservation({ subject: 'cold:sample',
  sourceEvent: 'cold:witness', amount: 7, at: 100 });
f.persistObservation(observation);
const sourceHistory = f.snapshot();
const binding = value(currentPeerHistoryBinding(sourceHistory, f.c));
const peers = [{ peer: 'machine-a', state: 'admitted' as const, sourceHistory,
  ...binding, observedAt: f.clock(190), lastFrontier: null, quantities: [] }];
const policy = { requiredPeers: ['machine-a'], evaluationClock: f.clock(200),
  maximumClockSkewMs: 10 };
const before = mergeCurrentPeerMeasurements(peers, policy, f.c);
f.quantity([observation], sourceHistory, 200);
const after = mergeCurrentPeerMeasurements(peers, policy, f.c);
process.stdout.write(JSON.stringify({ before, after }));
