import type { BoundaryContext, Hash, Json } from '../index.js';
import type { FactReference, OwnerReferenceEnrollment, ShapeChangeDocument, ShapeChangeEntry, ShapeEntries } from './types.js';
import { encoding, exact, list, number, object, requireThat, text, validated } from './boundary.js';

function hash(input: Json | undefined, field: string): Hash {
  const value = text(input, field);
  requireThat(/^sha256:[a-f0-9]{64}$/.test(value), `${field}: expected canonical hash`);
  return value as Hash;
}
function factReference(input: Json | undefined): FactReference {
  const value = object(input!); exact(value, ['owner', 'name', 'id']);
  requireThat(value.owner === 'part-two' && value.name === 'FactEnvelope', 'shape approval must name a part-two FactEnvelope');
  return { owner: 'part-two', name: 'FactEnvelope', id: text(value.id, 'approvedIn.id') };
}
function change(input: Json): ShapeChangeEntry {
  const value = object(input);
  const operation = text(value.operation, 'shape change operation');
  requireThat(['add', 'remove', 'replace'].includes(operation), 'unknown shape change operation');
  exact(value, operation === 'add' ? ['operation', 'path', 'after']
    : operation === 'remove' ? ['operation', 'path', 'before'] : ['operation', 'path', 'before', 'after']);
  const path = text(value.path, 'shape change path');
  requireThat(path.startsWith('/') && !path.endsWith('/') && !path.includes('//'), 'shape change path must be a canonical JSON pointer');
  if (operation !== 'add') requireThat(Object.hasOwn(value, 'before'), 'shape removal/replacement requires before');
  if (operation !== 'remove') requireThat(Object.hasOwn(value, 'after'), 'shape addition/replacement requires after');
  return { operation: operation as ShapeChangeEntry['operation'], path,
    ...(operation === 'add' ? { after: value.after! } : operation === 'remove' ? { before: value.before! } : { before: value.before!, after: value.after! }) };
}
const partUnits = new Map(Object.entries({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }));
const partTens = new Map(Object.entries({ twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90 }));

function ownerPart(owner: string): number | undefined {
  if (!owner.startsWith('part-')) return undefined;
  const words = owner.slice(5).split('-');
  if (words.length === 1) return partUnits.get(words[0]!) ?? partTens.get(words[0]!);
  if (words.length === 2) {
    const tens = partTens.get(words[0]!), unit = partUnits.get(words[1]!);
    if (tens !== undefined && unit !== undefined && unit < 10) return tens + unit;
  }
  return undefined;
}

export function resolveOwnerReferenceIdentity(input: Json): OwnerReferenceEnrollment {
  const value = object(input); exact(value, ['part', 'owner', 'manifest']);
  const part = number(value.part, 'owner enrollment part');
  requireThat(Number.isSafeInteger(part) && part > 0, 'owner enrollment part must be a positive integer');
  const owner = text(value.owner, 'owner enrollment owner');
  const manifest = object(value.manifest!); exact(manifest, ['path', 'hash']);
  const path = text(manifest.path, 'owner enrollment manifest path');
  requireThat(ownerPart(owner) === part && path === `register-source/owner-references/${owner}.json`,
    'owner enrollment part, owner, and manifest path must name one owner');
  return { part, owner, manifest: { path, hash: hash(manifest.hash, 'owner enrollment manifest hash') } };
}

export function decodeShapeChangeDocument(input: unknown, context: BoundaryContext) {
  return validated<ShapeChangeDocument, BoundaryContext>('ShapeChangeDocument', input, context, value => {
    exact(value, ['type', 'schemaVersion', 'id', 'parent', 'candidateShape', 'changes', 'ownerReferences', 'approvedIn']);
    requireThat(value.type === 'ShapeChangeDocument' && value.schemaVersion === 1, 'unknown shape-change document type/version');
    const changes = list(value.changes, 'shape changes').map(change);
    requireThat(changes.length > 0, 'shape-change document requires at least one exact change');
    requireThat(new Set(changes.map(row => row.path)).size === changes.length, 'duplicate shape change path');
    requireThat(changes.every((row, i) => i === 0 || changes[i - 1]!.path < row.path), 'shape changes must be path-sorted');
    const ownerReferences = list(value.ownerReferences, 'ownerReferences').map(resolveOwnerReferenceIdentity);
    requireThat(new Set(ownerReferences.map(row => row.part)).size === ownerReferences.length
      && new Set(ownerReferences.map(row => row.owner)).size === ownerReferences.length, 'duplicate owner-reference enrollment');
    requireThat(ownerReferences.every((row, i) => i === 0 || ownerReferences[i - 1]!.part < row.part),
      'owner-reference enrollments must be part-sorted');
    return { type: 'ShapeChangeDocument', schemaVersion: 1, id: text(value.id, 'shape change id'),
      parent: hash(value.parent, 'shape change parent'), candidateShape: hash(value.candidateShape, 'candidate shape'), changes,
      ownerReferences, approvedIn: factReference(value.approvedIn) } as unknown as ShapeChangeDocument;
  });
}

const escape = (value: string) => value.replaceAll('~', '~0').replaceAll('/', '~1');
function differences(before: Json, after: Json, path = ''): ShapeChangeEntry[] {
  if (encoding(before).bytes === encoding(after).bytes) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const result: ShapeChangeEntry[] = [];
    const shared = Math.min(before.length, after.length);
    for (let i = 0; i < shared; i++) result.push(...differences(before[i]!, after[i]!, `${path}/${i}`));
    for (let i = before.length - 1; i >= after.length; i--) result.push({ operation: 'remove', path: `${path}/${i}`, before: before[i]! });
    for (let i = before.length; i < after.length; i++) result.push({ operation: 'add', path: `${path}/${i}`, after: after[i]! });
    return result;
  }
  if (before !== null && after !== null && typeof before === 'object' && typeof after === 'object'
    && !Array.isArray(before) && !Array.isArray(after)) {
    const left = before as Record<string, Json>, right = after as Record<string, Json>, result: ShapeChangeEntry[] = [];
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      const at = `${path}/${escape(key)}`;
      if (!Object.hasOwn(left, key)) result.push({ operation: 'add', path: at, after: right[key]! });
      else if (!Object.hasOwn(right, key)) result.push({ operation: 'remove', path: at, before: left[key]! });
      else result.push(...differences(left[key]!, right[key]!, at));
    }
    return result;
  }
  return [{ operation: 'replace', path: path || '/', before, after }];
}

export function shapeDifferences(parent: ShapeEntries, candidate: ShapeEntries): readonly ShapeChangeEntry[] {
  return differences(JSON.parse(encoding(parent).bytes) as Json, JSON.parse(encoding(candidate).bytes) as Json)
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
export function validateShapeChangeDocument(parent: ShapeEntries, candidate: ShapeEntries, document: ShapeChangeDocument,
  context: BoundaryContext): boolean {
  requireThat(/^sha256:[a-f0-9]{64}$/.test(document.parent) && document.candidateShape === encoding(candidate).hash,
    'P3-NF-09: shape-change document candidate differs');
  requireThat(encoding(document.changes).bytes === encoding(shapeDifferences(parent, candidate)).bytes,
    'P3-NF-09: shape-change document does not name the exact shape entries changed');
  const introducedParts = candidate.parts.filter(part => !parent.parts.includes(part));
  for (const enrollment of document.ownerReferences) requireThat(introducedParts.includes(enrollment.part),
    `P3-NF-09: owner-reference enrollment part ${enrollment.part} is not introduced by this shape change`);
  void context;
  return true;
}
