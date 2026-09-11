import type { BoundaryContext, Json } from '../index.js';
import { exact, list, object, requireThat, text, validated } from './boundary.js';

export interface ParentGenerationSource {
  readonly commit: string;
  readonly register: 'generated/register.json';
  readonly source: 'generated/source.json';
  readonly conversion: 'generated/conversion.json';
}
export interface NormalRegisterWorkflow {
  readonly type: 'RegisterWorkflow'; readonly schemaVersion: 1; readonly mode: 'normal'; readonly branch: string;
  readonly parent: ParentGenerationSource; readonly extract: Json; readonly runs: readonly Json[]; readonly catalog: Json;
  readonly landedParts: readonly Json[]; readonly references: readonly Json[]; readonly claims: readonly Json[];
  readonly instances?: Json; readonly shapeChange?: Readonly<{ document: Readonly<{ path: string; hash: string }> }>;
}

const required = ['type', 'schemaVersion', 'mode', 'branch', 'parent', 'extract', 'runs', 'catalog', 'landedParts', 'references', 'claims'];
export function decodeNormalRegisterWorkflow(input: unknown, context: BoundaryContext) {
  return validated<NormalRegisterWorkflow, BoundaryContext>('RegisterWorkflow', input, context, value => {
    exact(value, [...required, 'instances', 'shapeChange']);
    requireThat(required.every(field => Object.hasOwn(value, field)), 'normal workflow missing required field');
    requireThat(value.type === 'RegisterWorkflow' && value.schemaVersion === 1 && value.mode === 'normal', 'unknown register workflow type/version/mode');
    const parent = object(value.parent!); exact(parent, ['commit', 'register', 'source', 'conversion']);
    requireThat(['commit', 'register', 'source', 'conversion'].every(field => Object.hasOwn(parent, field)), 'parent generation source is incomplete');
    const commit = text(parent.commit, 'parent commit');
    requireThat(/^[a-f0-9]{40}$/.test(commit), 'parent commit must be an exact commit id');
    requireThat(parent.register === 'generated/register.json' && parent.source === 'generated/source.json'
      && parent.conversion === 'generated/conversion.json', 'parent generation paths are closed');
    for (const field of ['runs', 'landedParts', 'references', 'claims']) list(value[field], field);
    object(value.catalog!); object(value.extract!);
    let shapeChange: NormalRegisterWorkflow['shapeChange'];
    if (value.shapeChange !== undefined) {
      const change = object(value.shapeChange); exact(change, ['document']);
      const document = object(change.document!); exact(document, ['path', 'hash']);
      const path = text(document.path, 'shape-change document path'), hash = text(document.hash, 'shape-change document hash');
      requireThat(path.startsWith('register-source/shape-changes/') && path.endsWith('.json'), 'shape-change document must use the governed source directory');
      requireThat(/^sha256:[a-f0-9]{64}$/.test(hash), 'shape-change document requires canonical hash');
      shapeChange = { document: { path, hash } };
    }
    return { type: 'RegisterWorkflow', schemaVersion: 1, mode: 'normal', branch: text(value.branch, 'branch'),
      parent: { commit, register: 'generated/register.json', source: 'generated/source.json', conversion: 'generated/conversion.json' },
      extract: value.extract!, runs: value.runs as Json[], catalog: value.catalog!, landedParts: value.landedParts as Json[],
      references: value.references as Json[], claims: value.claims as Json[], ...(value.instances !== undefined ? { instances: value.instances } : {}),
      ...(shapeChange ? { shapeChange } : {}) };
  });
}
