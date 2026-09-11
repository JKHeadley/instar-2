import type { Hash, Result } from '../index.js';
import type { FactReference, GeneratedRegister, RegisterContext, ShapeChangeDocument, ShapeEntries, VerifiedRegister } from './types.js';
import { checked, encoding, requireThat, take } from './boundary.js';
import { wasVerified, generateRegister, generationOf } from './generator.js';
import { validateShapeChangeDocument } from './shape-change.js';

export interface ShapeChangeBinding {
  readonly parent: Hash; readonly candidateShape: Hash;
  readonly document: Readonly<{ path: string; hash: Hash }>;
  readonly approval: FactReference;
}
export interface ShapeApprovalPort {
  readonly owner: 'part-two';
  // Verification must resolve operator approval of EXACTLY this binding, not
  // merely report that an unrelated approval fact exists.
  readonly verifyShapeChange: (binding: ShapeChangeBinding) => Result<FactReference>;
}
export function generateAgainstParent(input: unknown, parent: VerifiedRegister, candidate: ShapeEntries,
  change: ShapeChangeBinding | null, approvals: ShapeApprovalPort, context: RegisterContext, document?: ShapeChangeDocument) {
  return checked<GeneratedRegister, RegisterContext>('ParentShapeBuild', { input, parent, candidate, change }, context, () => {
    requireThat(wasVerified(parent), 'P3-NF-09: parent requires verified entering-force generation');
    const parentGeneration = take(generationOf(parent, context));
    if (encoding(candidate).hash !== encoding(parent.shape).hash) {
      requireThat(change && document && change.parent === parentGeneration.id && change.candidateShape === encoding(candidate).hash
        && change.document.path.length > 0 && /^sha256:[a-f0-9]{64}$/.test(change.document.hash), 'P3-NF-09: shape change lacks exact parent/document binding');
      requireThat(document.parent === change.parent && document.candidateShape === change.candidateShape
        && encoding(document.approvedIn).bytes === encoding(change.approval).bytes, 'P3-NF-09: shape-change document binding differs');
      validateShapeChangeDocument(parent.shape, candidate, document, context);
      requireThat(approvals.owner === 'part-two', 'shape approval requires part-two record provider');
      take(approvals.verifyShapeChange(change));
    } else requireThat(change === null, 'unchanged shape must not smuggle a change binding');
    // Candidate schema never supplies permission to its ordinary declarations.
    take(generateRegister(input, { ...context, shape: parent.shape }));
    // Approval permits a schema change, not an unloadable representation. Both
    // schemas must accept the same authored input; incompatible migrations refuse
    // here, before a generation can be published or its schema relabelled.
    return take(generateRegister(input, { ...context, shape: candidate }));
  });
}
