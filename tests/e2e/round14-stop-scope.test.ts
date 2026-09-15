// @ts-nocheck -- the production slice is an executable JavaScript boundary.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { consumeResult, decode } from '../../src/index.js';
import { bootProductionSliceAssembly, sliceConfig } from '../../scripts/slice-assembly.mjs';

const outcome = result => consumeResult(result, {
  Success: value => ({ accepted: true, value }),
  Refused: refusal => ({ accepted: false, detail: refusal.detail }),
});
const value = result => consumeResult(result, {
  Success: resolved => resolved,
  Refused: refusal => { throw new Error(refusal.detail); },
});

for (const [id, project] of [[77, 'project-a'], [78, 'project-b']]) {
  it(`V${id} P11-NF-05 P11-NF-08 P11-NF-22 P11-NF-34 P11-NF-39 the production stop never replaces confirmed ${project} scope`, () => {
    const boot = bootProductionSliceAssembly({ home: mkdtempSync(join(tmpdir(), 'p11-round14-stop-')),
      config: sliceConfig({ profile: 'reply' }), restartRecovery: true });
    const surface = boot.coordinator.handles.surface;
    const scope = value(decode('Scope', { type: 'Scope', schemaVersion: 1, kind: 'project', members: [project] }, boot.decodeContext));
    const challenge = value(surface.stopChallenge({ operator: boot.alice.id, scope }));
    const result = outcome(surface.stop({ challenge, proof: 'verified-restart-operator-proof', scope }));
    if (project === 'project-a') expect(result.accepted).toBe(true);
    if (result.accepted) {
      const fact = boot.facts().find(candidate => candidate.id === result.value.id);
      expect(fact?.kind).toBe('intake-stop');
      expect(fact?.body.scope).toEqual(scope);
    } else {
      expect(result.detail).toContain('scope differs');
      expect(boot.facts().filter(candidate => candidate.kind === 'intake-stop')).toHaveLength(0);
    }
  }, 300_000);
}
