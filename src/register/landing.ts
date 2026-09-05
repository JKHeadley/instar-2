import { decode, grantLiveness, scopeIncludes } from '../index.js';
import type { GeneratedRegister, RegisterContext, SpineReadPort, StandingContext } from './types.js';
import { checked, requireThat, take } from './boundary.js';
import { decodeExtract, decodeGenerationRecord, generateRegister, generationOf } from './generator.js';
import { verifyLandingCompletion } from './governance.js';

// Pure plan only. P2 owns append/admission; a proposed record is never evidence that
// entering force already occurred. Consumers still go through loadRegister's lookup.
export function planLandingCompletion(before: GeneratedRegister, extractInput: unknown, standing: StandingContext,
  spine: SpineReadPort, context: RegisterContext) {
  return checked('LandingCompletion', { before, extractInput, standing }, context, () => {
    requireThat(standing.principal.kind === 'system', 'landing completion requires system principal');
    take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id: standing.principal.id, kind: 'system' },
      { ...context.types, provenance: standing.principal.provenance }));
    for (const action of ['append:version-chain', 'append:generation-record', 'append:check-run-record'])
      requireThat(standing.grants.some(g => g.grantee.id === standing.principal.id && grantLiveness(g, standing.revocations, standing.now) === 'live'
        && scopeIncludes(g.scope, standing.scope) && (g.standing === 'operator' || g.actions.includes(action))), `landing standing missing or revoked: ${action}`);
    requireThat(spine.owner === 'part-two', 'landing requires verified part-two spine');
    const extract = take(decodeExtract(extractInput, context)); take(spine.verifyExtract(extract));
    const sources = before.entries.map(e => {
      const { declaredBy, ...declaration } = e.declaration;
      // Families have already expanded; a completion changes only landing facts.
      return { path: declaredBy.path, symbol: declaredBy.symbol, declaration };
    });
    // No family re-enumeration occurs at landing; preserve the complete already-reviewed list.
    const instances = Object.fromEntries(before.entries.filter(e => e.declaration.family).map(e => [e.declaration.family!.source, []]));
    const after = take(generateRegister({ commit: before.commit, complete: true, extract, sources, instances }, context));
    take(verifyLandingCompletion(before, after, context));
    const generation = take(generationOf(after, context));
    const recordToAppend = take(decodeGenerationRecord({ type: 'GenerationRecord', schemaVersion: 1, generation, at: standing.now }, context));
    return { register: after, recordToAppend, authority: 'requires-part-two-append' as const };
  });
}
