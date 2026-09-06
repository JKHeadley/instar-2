// @ts-expect-error the minimal-plane declarations are JavaScript, outside pure core compilation.
import { NESTED_RECORD_REASON as nested, RUN_KIND_REASON as runKind, minimalPlaneProjectionIds as ids, minimalPlaneProjections as build } from '../../scripts/slice-projections.mjs';

export type Decision = { kind: 'ignores'; reason: string } | { kind: 'folds'; merge: string; identity: string; value: string };
export interface PlaneProjection {
  readonly id: string; readonly class: string; readonly stalenessBound: number;
  readonly retention: string; readonly decisions: Readonly<Record<string, Decision>>;
}
export const NESTED_RECORD_REASON = nested as string;
export const RUN_KIND_REASON = runKind as string;
export const minimalPlaneProjectionIds: readonly string[] = ids as readonly string[];
export const minimalPlaneProjections = build as (kinds: readonly string[], stalenessBound?: number) => readonly PlaneProjection[];
