import { it } from 'vitest';
import { appendImpossibleHistoryAccounting, impossibleHistoryContinuityFixture } from '../rungraph/closure-fixtures.js';
import { ref, refused } from '../rungraph/fixtures.js';

it('P5-SEAM-RC-R6-V38-SEND-INTEGRATION re-resolves full signed run history before admitting the first reply send', () => {
  const f = impossibleHistoryContinuityFixture();
  const admitted = appendImpossibleHistoryAccounting(f);
  refused(f.graph.verifyContinuitySend(admitted.reference, ref(admitted.send)),
    'conflicted or tainted authority');
});
