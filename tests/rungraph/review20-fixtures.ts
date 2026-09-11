import type { Json } from '../../src/index.js';
import { factId, signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { privateKey } from '../facts/fixtures.js';

export function signedNext(fixture: Readonly<{ bob: FactEnvelope['principal'];
  deps: Readonly<{ clock: () => FactEnvelope['at'] }> }>, previous: FactEnvelope, kind: string,
  body: Json, required: readonly string[] = []): FactEnvelope {
  const segment = { machine: previous.machine, epoch: previous.segment.epoch,
    position: previous.segment.position + 1 };
  return signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind,
    schemaVersion: 1, at: fixture.deps.clock(), machine: previous.machine,
    principal: fixture.bob, provenance: fixture.bob.provenance, segment,
    prevInSegment: previous.contentHash,
    predecessors: { inSegment: previous.id, frontier: {}, required: [...required] }, body }, privateKey) as FactEnvelope;
}
