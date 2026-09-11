import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider } from '../../src/register/index.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { setup, value } from '../register/fixtures.js';

const detail = (result: ReturnType<ReturnType<typeof createPartTwoRegisterProvider>['verifySemanticReview']>) =>
  consumeResult(result, { Success: () => 'success', Refused: refusal => refusal.detail });

describe('normal workflow signed evidence composition', () => {
  it('P3-NF-28 accepts a real Part Nine semantic-review fact and refuses an ordinary signed note substitute', () => {
    const v = verificationRuntimeFixture();
    const record = value(v.runtime.record('SemanticReviewRecord', verificationInput('SemanticReviewRecord')));
    const first = value(v.store.read())[0]!;
    const note = v.next(first, {}, { ...v.context, facts: [first] });
    v.bytes.push(JSON.parse(JSON.stringify(note)));
    const snapshot = value(v.store.read());
    const s = setup(); const vector = { owner: 'part-two' as const, name: 'FactPositionVector' as const, id: s.extract.vector.id };
    const authority = createPartTwoRegisterAuthority({ vector, facts: { ...v.context, facts: snapshot }, scope: v.scope,
      landing: { owner: 'part-ten', merges: [] }, versions: [], context: s.context });
    const provider = createPartTwoRegisterProvider({ store: v.store, authority, horizon: { lineages: {
      'machine-a': { head: { epoch: 0, position: 1 }, observedAt: 100, closed: false },
    }, stalenessBound: 100 }, context: s.context });
    const review = { holder: 'holder', rule: 26, generation: record.generation,
      subjectHash: 'sha256:subject', record: first.id };
    expect(value(provider.verifySemanticReview(review))).toBe(true);
    expect(detail(provider.verifySemanticReview({ ...review, record: note.id }))).toContain('semantic review reference kind differs');
  });
});
