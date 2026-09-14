import type { Hash, Json, Result } from '../index.js';
import type { FactReference, GeneratedRegister, OwnerReferenceEnrollment, RegisterContext, ShapeChangeDocument, ShapeEntries, VerifiedRegister } from './types.js';
import { checked, encoding, exact, list, number, object, requireThat, strings, take, text } from './boundary.js';
import { wasVerified, generateRegister, generationOf } from './generator.js';
import { validateShapeChangeDocument } from './shape-change.js';

export interface GovernedShapeChangeBinding {
  readonly parent: Hash; readonly candidateShape: Hash;
  readonly document: Readonly<{ path: string; hash: Hash }>;
  readonly approval: FactReference;
}
// The pre-shape-document public input remains accepted only on its original,
// non-governed path. Normal mode always constructs the governed arm below.
export interface LegacyShapeChangeBinding {
  readonly parent: Hash; readonly candidateShape: Hash;
  readonly document: Readonly<{ path: string; hash: Hash }>;
  readonly approval?: never;
}
export type ShapeChangeBinding = GovernedShapeChangeBinding | LegacyShapeChangeBinding;
export interface ShapeApprovalPort {
  readonly owner: 'part-two';
  // Verification must resolve operator approval of EXACTLY this binding, not
  // merely report that an unrelated approval fact exists.
  readonly verifyShapeChange: (binding: ShapeChangeBinding) => Result<FactReference>;
}

export interface OwnerReferenceEnrollmentApproval {
  readonly binding: GovernedShapeChangeBinding;
  readonly document: ShapeChangeDocument;
}

export function resolveOwnerReferenceEnrollments(enrollments: readonly OwnerReferenceEnrollment[],
  parent: VerifiedRegister, candidate: ShapeEntries, change: ShapeChangeBinding | null,
  approvals: ShapeApprovalPort, context: RegisterContext, document?: ShapeChangeDocument,
  enrollmentApprovals: readonly OwnerReferenceEnrollmentApproval[] = []) {
  return checked<readonly OwnerReferenceEnrollment[], RegisterContext>('OwnerReferenceEnrollments',
    { enrollments, parent, candidate, change, enrollmentApprovals, ...(document === undefined ? {} : { document }) }, context, raw => {
      const input = object(raw);
      const capturedEnrollments = input.enrollments as unknown as readonly OwnerReferenceEnrollment[];
      const capturedCandidate = input.candidate as unknown as ShapeEntries;
      const capturedChange = input.change as unknown as ShapeChangeBinding | null;
      const capturedDocument = input.document as unknown as ShapeChangeDocument | undefined;
      const capturedApprovals = input.enrollmentApprovals as unknown as readonly OwnerReferenceEnrollmentApproval[];
      requireThat(wasVerified(parent, context.authorityTypes?.now ?? context.types.now),
        'P3-NF-09: owner enrollments require the witnessed parent generation');
      const current = capturedChange !== null && capturedChange.approval !== undefined && capturedDocument !== undefined
        ? [{ binding: capturedChange as GovernedShapeChangeBinding, document: capturedDocument }] : [];
      const evidence = [...current, ...capturedApprovals].filter((row, index, rows) =>
        rows.findIndex(candidate => encoding(candidate.binding).bytes === encoding(row.binding).bytes) === index);
      for (const enrollment of capturedEnrollments) {
        requireThat(capturedCandidate.parts.includes(enrollment.part),
          'P3-NF-09: owner enrollment for a part absent from the parent requires the exact current signed shape-change document');
        const witnessed = evidence.filter(row => row.document.ownerReferences
          .some(reference => encoding(reference).bytes === encoding(enrollment).bytes));
        requireThat(witnessed.length === 1,
          'P3-NF-09: owner enrollment requires one exact signed shape-change document for its part, owner, manifest path, and hash');
        const { binding, document: approvedDocument } = witnessed[0]!;
        requireThat(binding.document.hash === encoding(approvedDocument).hash
          && approvedDocument.parent === binding.parent && approvedDocument.candidateShape === binding.candidateShape
          && encoding(approvedDocument.approvedIn).bytes === encoding(binding.approval).bytes,
        'P3-NF-09: owner enrollment shape-change binding differs');
        take(approvals.verifyShapeChange(binding));
      }
      return capturedEnrollments;
    });
}

function profileExpression(input: Json, depth = 0): void {
  requireThat(depth < 32, 'derived adjective expression exceeds depth');
  const value = object(input);
  if (Object.hasOwn(value, 'field')) {
    exact(value, ['field', 'in']);
    requireThat(['consequence', 'reversibility', 'reach', 'surface'].includes(text(value.field, 'derivedFrom.field')),
      'unknown derived adjective profile field');
    requireThat(strings(value.in, 'derivedFrom.in').length > 0, 'derived adjective expression needs values');
    return;
  }
  const keys = ['any', 'all'].filter(key => Object.hasOwn(value, key));
  requireThat(keys.length === 1, 'derived adjective expression needs exactly one operator');
  exact(value, keys); const children = list(value[keys[0]!], `derivedFrom.${keys[0]}`);
  requireThat(children.length > 0, 'derived adjective expression needs children');
  for (const child of children) profileExpression(child as Json, depth + 1);
}

// These checks belong exactly to the post-bootstrap parent/provider seam.
// The protected general declaration decoder remains byte-identical to main.
function validateParentBuildInput(input: unknown, shape: ShapeEntries): void {
  const build = object(input as Json);
  for (const sourceInput of list(build.sources, 'sources')) {
    const declaration = object(object(sourceInput).declaration!);
    const kind = text(declaration.kind, 'kind'); const facts = object(declaration.requiredFacts!);
    const kindShape = shape.kinds.find(candidate => candidate.name === kind);
    requireThat(kindShape, `P3-NF-03: unknown kind ${kind}`);
    for (const field of kindShape.fields.filter(candidate => candidate.format === 'array' && candidate.reference))
      if (facts[field.name] !== undefined) strings(facts[field.name], `${kind}.${field.name}`);
    if (kind === 'rules') {
      const rule = number(facts.number, 'rules.number');
      requireThat(Number.isSafeInteger(rule) && rule > 0, 'rules.number must be a positive integer');
      if (facts.parent !== 'root') {
        const parent = number(facts.parent, 'rules.parent');
        requireThat(Number.isSafeInteger(parent) && parent > 0, 'rules.parent must be root or a positive integer');
      }
      strings(facts.termRefs, 'rules.termRefs');
    }
    if (kind === 'terms' && facts.kind === 'adjective') profileExpression(facts.derivedFrom!);
  }
}
export function generateAgainstParent(input: unknown, parent: VerifiedRegister, candidate: ShapeEntries,
  change: ShapeChangeBinding | null, approvals: ShapeApprovalPort, context: RegisterContext, document?: ShapeChangeDocument) {
  return checked<GeneratedRegister, RegisterContext>('ParentShapeBuild',
    { input, parent, candidate, change, ...(document === undefined ? {} : { document }) }, context, raw => {
    const captured = object(raw);
    const buildInput = captured.input;
    const candidate = captured.candidate as unknown as ShapeEntries;
    const change = captured.change as unknown as ShapeChangeBinding | null;
    const document = captured.document as unknown as ShapeChangeDocument | undefined;
    requireThat(wasVerified(parent, context.authorityTypes?.now ?? context.types.now),
      'P3-NF-09: parent requires verified entering-force generation');
    validateParentBuildInput(buildInput, parent.shape);
    const parentGeneration = take(generationOf(parent, context));
    if (encoding(candidate).hash !== encoding(parent.shape).hash) {
      requireThat(change && change.parent === parentGeneration.id && change.candidateShape === encoding(candidate).hash
        && change.document.path.length > 0 && /^sha256:[a-f0-9]{64}$/.test(change.document.hash), 'P3-NF-09: shape change lacks exact parent/document binding');
      const governed = change.approval !== undefined;
      if (governed) {
        requireThat(document && change.approval !== undefined, 'P3-NF-09: governed shape change requires its approved document');
        requireThat(change.document.hash === encoding(document).hash, 'P3-NF-09: supplied shape-change document bytes differ from binding');
        requireThat(document.parent === change.parent && document.candidateShape === change.candidateShape
          && encoding(document.approvedIn).bytes === encoding(change.approval).bytes, 'P3-NF-09: shape-change document binding differs');
        validateShapeChangeDocument(parent.shape, candidate, document, context);
      } else requireThat(document === undefined, 'legacy shape-change binding cannot attach a governed document');
      requireThat(approvals.owner === 'part-two', 'shape approval requires part-two record provider');
      take(approvals.verifyShapeChange(change));
    } else requireThat(change === null, 'unchanged shape must not smuggle a change binding');
    // Candidate schema never supplies permission to its ordinary declarations.
    take(generateRegister(buildInput, { ...context, shape: parent.shape }));
    // Approval permits a schema change, not an unloadable representation. Both
    // schemas must accept the same authored input; incompatible migrations refuse
    // here, before a generation can be published or its schema relabelled.
    return take(generateRegister(buildInput, { ...context, shape: candidate }));
  });
}
