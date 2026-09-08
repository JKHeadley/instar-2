import { describe, expect, it } from 'vitest';
import type { OwnedReference } from '../../src/index.js';
import { createJudgmentBenchmarkReadPort } from '../../src/judgment/index.js';
import { judgmentFixture, refused, value } from './fixture.js';

describe('part-seven judgment benchmark read port', { timeout: 30_000 }, () => {
  it('P7-NF-32 P7-NF-33 reads one immutable manifest directly from admitted request neighbors', async () => {
    const f = judgmentFixture();
    const answer = value(await f.door.judge(f.input, f.start()));
    const facts = value(f.door.inspect());
    const requestFact = facts.find(row => row.record.type === 'JudgmentRequest')!;
    const port = createJudgmentBenchmarkReadPort(f.spine, f.c);
    const manifest = value(port.readManifest({ owner: 'part-seven', name: 'JudgmentRequest', id: requestFact.fact.id }));
    expect(port.owner).toBe('part-seven');
    expect(manifest.request.id).toBe(f.input.id);
    expect(manifest.resolution?.id).toBe(`${f.input.id}:resolution`);
    expect(manifest.decision?.id).toBe(answer.decision.id);
    expect(manifest.conclusionEvidence).toEqual(answer.decision.conclusion.evidence);
    expect(manifest.reasonEvidence).toEqual(answer.decision.reason.evidence);
    expect(manifest.captureReferences.map(capture => capture.reference)).toHaveLength(4);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.keys(port).sort()).toEqual(['owner', 'readManifest', 'readRecord', 'readRun', 'readScenario']);
  });

  it('P7-NF-32 P7-NF-34 refuses absent or wrong-owner request and record neighbors without inventing defaults', () => {
    const f = judgmentFixture(), port = createJudgmentBenchmarkReadPort(f.spine, f.c);
    refused(port.readManifest({ owner: 'part-seven', name: 'JudgmentRequest', id: 'missing' }), 'absent');
    refused(port.readRecord({ owner: 'part-seven', name: 'BenchmarkRecord', id: 'missing' }), 'absent');
    refused(port.readScenario({ owner: 'part-seven', name: 'BenchmarkScenario', id: 'missing' }), 'absent');
    refused(port.readRun({ owner: 'part-seven', name: 'BenchmarkRunRecord', id: 'missing' }), 'absent');
    refused(port.readManifest({ owner: 'part-nine', name: 'JudgmentRequest', id: 'missing' } as unknown as OwnedReference<'part-seven', 'JudgmentRequest'>), 'owner');
  });
});
