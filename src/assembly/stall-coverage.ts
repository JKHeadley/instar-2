import { boundary, ensure, freeze } from './boundary.js';
import type { BoundaryContext, Result } from '../index.js';

/**
 * Rule 59 (D14 §3, P10-NF-15/16): every harness enumerates how a session can silently stop
 * before it is admitted. These are the design's nine stall classes; a harness declares, for each,
 * the actual evidence that detects it, the permitted recovery, and one captured positive case and
 * one captured failing case. An incomplete table refuses onboarding; nothing is discovered later.
 */
export const HARNESS_STALL_CLASSES = Object.freeze([
  'launch-rejected-or-answer-lost',
  'input-buffered-not-consumed',
  'prompt-approval-or-tool-wait',
  'provider-unavailable-or-expired',
  'worker-exit-or-process-reuse',
  'alive-without-progress',
  'context-compacted-or-limit',
  'output-partial-malformed-or-delayed',
  'stop-fence-or-resource-loss',
] as const);
export type HarnessStallClass = typeof HARNESS_STALL_CLASSES[number];

/** A captured case: a test in the shipped repository, named by file and exact title. */
export interface StallCaseRef { readonly file: string; readonly title: string }
export interface StallCoverageRow {
  readonly stall: HarnessStallClass;
  /** The actual evidence that raises this stall (never a terminal scrape or a timer alone). */
  readonly detection: string;
  /** The recovery the harness is permitted to perform, or the owner it hands the case to. */
  readonly recovery: string;
  readonly positive: StallCaseRef;
  readonly failing: StallCaseRef;
}
export interface HarnessStallCoverage {
  readonly type: 'HarnessStallCoverage';
  readonly harness: string;
  readonly rows: readonly StallCoverageRow[];
}

const text = (value: unknown, minimum = 1) => typeof value === 'string' && value.trim().length >= minimum;
const caseRef = (value: unknown): value is StallCaseRef => !!value && typeof value === 'object'
  && text((value as StallCaseRef).file) && /^tests\/[^\s]+\.test\.ts$/u.test((value as StallCaseRef).file)
  && !(value as StallCaseRef).file.includes('..') && text((value as StallCaseRef).title, 8);

/** Every reason a declaration is not a complete stall table; empty means it is complete. */
export function stallCoverageGaps(declaration: unknown): readonly string[] {
  if (!declaration || typeof declaration !== 'object') return ['stall coverage declaration missing'];
  const coverage = declaration as Partial<HarnessStallCoverage>;
  const gaps: string[] = [];
  if (coverage.type !== 'HarnessStallCoverage') gaps.push('stall coverage type missing');
  if (!text(coverage.harness)) gaps.push('stall coverage names no harness');
  const rows = Array.isArray(coverage.rows) ? coverage.rows as readonly Partial<StallCoverageRow>[] : [];
  const known = new Set<string>(HARNESS_STALL_CLASSES), seen = new Set<string>();
  for (const row of rows) {
    const stall = typeof row?.stall === 'string' ? row.stall : '';
    if (!known.has(stall)) { gaps.push(`unknown stall class ${stall || '(none)'}`); continue; }
    if (seen.has(stall)) gaps.push(`${stall}: declared twice`);
    seen.add(stall);
    if (!text(row.detection, 8)) gaps.push(`${stall}: no detection evidence`);
    if (!text(row.recovery, 8)) gaps.push(`${stall}: no recovery`);
    if (!caseRef(row.positive)) gaps.push(`${stall}: no captured positive case`);
    if (!caseRef(row.failing)) gaps.push(`${stall}: no captured failing case`);
    if (caseRef(row.positive) && caseRef(row.failing) && row.positive.file === row.failing.file && row.positive.title === row.failing.title)
      gaps.push(`${stall}: positive and failing cases are the same case`);
  }
  for (const stall of HARNESS_STALL_CLASSES) if (!seen.has(stall)) gaps.push(`${stall}: not enumerated`);
  return gaps;
}

/** Onboarding admission: refuses an incomplete table with every missing row named. */
export function admitStallCoverage(declaration: unknown, context: BoundaryContext): Result<HarnessStallCoverage> {
  return boundary('HarnessStallCoverageAdmission', declaration, context, () => {
    const gaps = stallCoverageGaps(declaration);
    ensure(gaps.length === 0, `harness stall coverage incomplete: ${gaps.join('; ')}`);
    return freeze(JSON.parse(JSON.stringify(declaration)) as HarnessStallCoverage);
  });
}

/** Resolves each captured case against the shipped repository through the caller's reader. */
export function unresolvedStallCases(coverage: HarnessStallCoverage, read: (file: string) => string | null): readonly string[] {
  const missing: string[] = [];
  for (const row of coverage.rows) for (const [side, ref] of [['positive', row.positive], ['failing', row.failing]] as const) {
    const source = read(ref.file);
    if (source === null || !(source.includes(`'${ref.title}'`) || source.includes(`"${ref.title}"`) || source.includes(`\`${ref.title}\``)))
      missing.push(`${row.stall}: ${side} case "${ref.title}" not found in ${ref.file}`);
  }
  return missing;
}
