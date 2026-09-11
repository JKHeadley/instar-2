import type { Json } from '../index.js';
import type { CheckCatalog } from '../rulegraph/graph.js';
import { decodeCheckRun } from '../rulegraph/graph.js';
import type { ChainExtract, CheckRunRecord, RegisterContext, RegisterValue } from './types.js';
import { decodeExtract } from './generator.js';
import { exact, list, number, object, requireThat, take, text, validated } from './boundary.js';

export interface ParentGenerationSource {
  readonly commit: string;
  readonly register: 'generated/register.json';
  readonly source: 'generated/source.json';
  readonly conversion: 'generated/conversion.json';
}
export type NormalRegisterWorkflow = RegisterValue<'RegisterWorkflow'> & Readonly<{
  mode: 'normal'; branch: string; parent: ParentGenerationSource; extract: ChainExtract;
  runs: readonly CheckRunRecord[]; catalog: CheckCatalog; landedParts: readonly number[];
  references: readonly Readonly<{ provider: string; id: string; kind?: string }>[];
  claims: readonly Readonly<{ kind: string; complete: boolean }>[];
  instances?: Readonly<Record<string, readonly Readonly<{ id: string; requiredFacts: Readonly<Record<string, Json>> }>[]>>;
  shapeChange?: Readonly<{ document: Readonly<{ path: string; hash: string }> }>;
}>;

const required = ['type', 'schemaVersion', 'mode', 'branch', 'parent', 'extract', 'runs', 'catalog', 'landedParts', 'references', 'claims'];
const positiveInteger = (input: Json, field: string): number => {
  const value = number(input, field); requireThat(Number.isSafeInteger(value) && value > 0, `${field}: expected positive integer`); return value;
};
function catalog(input: Json): CheckCatalog {
  const value = object(input); exact(value, ['fixtures', 'probes', 'sentinels', 'semanticReviews']);
  for (const field of ['fixtures', 'probes', 'sentinels', 'semanticReviews']) requireThat(Object.hasOwn(value, field), `catalog.${field} is required`);
  const artifact = (input: Json, field: string) => { const row = object(input); exact(row, ['path', 'hash']);
    const hash = text(row.hash, `${field}.hash`); requireThat(/^sha256:[a-f0-9]{64}$/.test(hash), `${field}.hash must be canonical`);
    return { path: text(row.path, `${field}.path`), hash }; };
  const fixtures = list(value.fixtures, 'catalog.fixtures').map(input => { const row = object(input); exact(row, ['id', 'stage', 'artifact']);
    return { id: text(row.id, 'fixture.id'), stage: text(row.stage, 'fixture.stage'),
      ...(row.artifact === undefined ? {} : { artifact: artifact(row.artifact, 'fixture.artifact') }) }; });
  const probes = list(value.probes, 'catalog.probes').map(input => { const row = object(input); exact(row, ['id', 'cadence', 'execution', 'artifact']);
    const cadence = number(row.cadence, 'probe.cadence'); requireThat(cadence > 0, 'probe.cadence must be positive');
    if (row.execution !== undefined) requireThat(row.execution === 'ci', 'probe.execution must be ci');
    return { id: text(row.id, 'probe.id'), cadence, ...(row.execution === undefined ? {} : { execution: 'ci' as const }),
      ...(row.artifact === undefined ? {} : { artifact: artifact(row.artifact, 'probe.artifact') }) }; });
  const sentinels = list(value.sentinels, 'catalog.sentinels').map(input => { const row = object(input); exact(row, ['id', 'freshnessProbe']);
    return { id: text(row.id, 'sentinel.id'), freshnessProbe: text(row.freshnessProbe, 'sentinel.freshnessProbe') }; });
  const semanticReviews = list(value.semanticReviews, 'catalog.semanticReviews').map(input => { const row = object(input);
    exact(row, ['holder', 'rule', 'generation', 'subjectHash', 'record']);
    return { holder: text(row.holder, 'semanticReview.holder'), rule: positiveInteger(row.rule!, 'semanticReview.rule'),
      generation: text(row.generation, 'semanticReview.generation'), subjectHash: text(row.subjectHash, 'semanticReview.subjectHash'),
      record: text(row.record, 'semanticReview.record') }; });
  return { fixtures, probes, sentinels, semanticReviews };
}
function instances(input: Json): NormalRegisterWorkflow['instances'] {
  const value = object(input); const decoded: Record<string, readonly Readonly<{ id: string; requiredFacts: Readonly<Record<string, Json>> }>[]> = {};
  for (const [source, raw] of Object.entries(value)) {
    requireThat(source.length > 0, 'instance source must be nonempty');
    decoded[source] = list(raw, `instances.${source}`).map(input => { const row = object(input); exact(row, ['id', 'requiredFacts']);
      return { id: text(row.id, 'instance.id'), requiredFacts: object(row.requiredFacts!) }; });
  }
  return decoded;
}

export function decodeNormalRegisterWorkflow(input: unknown, context: RegisterContext) {
  return validated<NormalRegisterWorkflow, RegisterContext>('RegisterWorkflow', input, context, value => {
    exact(value, [...required, 'instances', 'shapeChange']);
    requireThat(required.every(field => Object.hasOwn(value, field)), 'normal workflow missing required field');
    requireThat(value.type === 'RegisterWorkflow' && value.schemaVersion === 1 && value.mode === 'normal', 'unknown register workflow type/version/mode');
    const parent = object(value.parent!); exact(parent, ['commit', 'register', 'source', 'conversion']);
    requireThat(['commit', 'register', 'source', 'conversion'].every(field => Object.hasOwn(parent, field)), 'parent generation source is incomplete');
    const commit = text(parent.commit, 'parent commit');
    requireThat(/^[a-f0-9]{40}$/.test(commit), 'parent commit must be an exact commit id');
    requireThat(parent.register === 'generated/register.json' && parent.source === 'generated/source.json'
      && parent.conversion === 'generated/conversion.json', 'parent generation paths are closed');
    const runs = list(value.runs, 'runs').map(row => take(decodeCheckRun(row, context)));
    const landedParts = list(value.landedParts, 'landedParts').map(row => positiveInteger(row, 'landed part'));
    requireThat(new Set(landedParts).size === landedParts.length, 'duplicate landed part');
    const references = list(value.references, 'references').map(input => { const row = object(input); exact(row, ['provider', 'id', 'kind']);
      return { provider: text(row.provider, 'reference.provider'), id: text(row.id, 'reference.id'),
        ...(row.kind === undefined ? {} : { kind: text(row.kind, 'reference.kind') }) }; });
    const claims = list(value.claims, 'claims').map(input => { const row = object(input); exact(row, ['kind', 'complete']);
      requireThat(typeof row.complete === 'boolean', 'claim.complete must be boolean');
      return { kind: text(row.kind, 'claim.kind'), complete: row.complete }; });
    const decodedCatalog = catalog(value.catalog!); const extract = take(decodeExtract(value.extract, context));
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
      extract, runs, catalog: decodedCatalog, landedParts, references, claims,
      ...(value.instances !== undefined ? { instances: instances(value.instances) } : {}), ...(shapeChange ? { shapeChange } : {}) } as unknown as NormalRegisterWorkflow;
  });
}
