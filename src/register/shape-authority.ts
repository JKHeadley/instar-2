import type { Hash, Result } from '../index.js';
import type { FactReference, GeneratedRegister, RegisterContext, ShapeEntries, VerifiedRegister } from './types.js';
import { checked, encoding, requireThat, take } from './boundary.js';
import { wasVerified, generateRegister, generationOf } from './generator.js';

export interface ShapeChangeBinding {
  readonly parent: Hash; readonly candidateShape: Hash;
  readonly document: Readonly<{ path: string; hash: Hash }>;
}
export interface ShapeApprovalPort {
  readonly owner: 'part-two';
  // Verification must resolve operator approval of EXACTLY this binding, not
  // merely report that an unrelated approval fact exists.
  readonly verifyShapeChange: (binding: ShapeChangeBinding) => Result<FactReference>;
}
export function generateAgainstParent(input: unknown, parent: VerifiedRegister, candidate: ShapeEntries,
  change: ShapeChangeBinding | null, approvals: ShapeApprovalPort, context: RegisterContext) {
  return checked<GeneratedRegister, RegisterContext>('ParentShapeBuild', { input, parent, candidate, change }, context, () => {
    requireThat(wasVerified(parent), 'P3-NF-09: parent requires verified entering-force generation');
    const parentGeneration = take(generationOf(parent, context));
    if (encoding(candidate).hash !== encoding(parent.shape).hash) {
      requireThat(change && change.parent === parentGeneration.id && change.candidateShape === encoding(candidate).hash
        && change.document.path.length > 0 && /^sha256:[a-f0-9]{64}$/.test(change.document.hash), 'P3-NF-09: shape change lacks exact parent/document binding');
      requireThat(approvals.owner === 'part-two', 'shape approval requires part-two record provider');
      take(approvals.verifyShapeChange(change));
    } else requireThat(change === null, 'unchanged shape must not smuggle a change binding');
    // Candidate schema never supplies permission to its ordinary declarations.
    const register = take(generateRegister(input, { ...context, shape: parent.shape }));
    return { ...register, shape: candidate } as GeneratedRegister;
  });
}
