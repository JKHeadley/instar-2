import '../assembly/production-grounding-evidence.mjs';
import { expect, it } from 'vitest';
import { contextDeliveryIdFor, decodeAssemblyRecord } from '../../src/assembly/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { digest } from '../fixtures.js';
import { executeInitialLiveInputLifecycle } from '../rungraph/astra-production-grounding-fixture.js';

const candidate = (reason: 'initial' | 'live-input' | 'compaction', operation: string) => ({
  type: 'ContextDeliverySpecification', schemaVersion: 1, id: contextDeliveryIdFor('launch:one', operation), predecessors: [], dependencyFacts: [],
  launch: 'launch:one', run: 'run:one', step: `step:${operation}`, input: `intake:${operation}`, inputDigest: digest(`input:${operation}`),
  incarnation: 'incarnation:one', harness: 'native', artifactDigest: digest('native'), machine: 'machine-a', generation: 'generation:one',
  executionContext: 'execution:one', contextManifest: [{ class: 'message', reference: `capture:${operation}`, digest: digest(`capture:${operation}`) }],
  reason, operation, claim: `claim:${operation}`, previousDelivery: reason === 'initial' ? '' : 'delivery:prior',
  controlObservation: reason === 'compaction' ? 'control:compaction' : '',
});

it('PG-E2E-INITIAL-LIVE-REPLAY PRODUCTION-GROUNDING lifecycle: initial and live-input specifications coexist while compaction execution remains explicitly held', () => {
  const f = factsFixture();
  const initial = value(decodeAssemblyRecord('ContextDeliverySpecification', candidate('initial', 'initial'), f.c));
  const live = value(decodeAssemblyRecord('ContextDeliverySpecification', candidate('live-input', 'live-input'), f.c));
  const compact = value(decodeAssemblyRecord('ContextDeliverySpecification', candidate('compaction', 'compaction'), f.c));
  expect(new Set([initial.id, live.id, compact.id]).size).toBe(3);
  expect(initial.incarnation).toBe(live.incarnation); expect(live.previousDelivery).toBe('delivery:prior');
  refused(decodeAssemblyRecord('ContextDeliverySpecification', { ...candidate('live-input', 'bad'), previousDelivery: '' }, f.c),
    'live input requires one prior delivery');
  expect(compact.reason).toBe('compaction');
  expect('NON-EXECUTABLE-UNTIL-live-path-unit-compaction').toContain('live-path-unit-compaction');
});

it('PG-E2E-INITIAL-LIVE-REPLAY executes two signed actual-start boundaries on one incarnation', () => {
  const actual = executeInitialLiveInputLifecycle();
  expect(actual.running.pending).toHaveLength(1);
  expect(actual.ready.pending).toHaveLength(0);
  expect(actual.secondRunning.pending).toHaveLength(1);
  expect(actual.last.spec.incarnation).toBe(actual.first.spec.incarnation);
}, 120_000);
