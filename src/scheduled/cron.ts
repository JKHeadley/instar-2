import type { BoundaryContext, Result } from '../index.js';
import { boundary, ensure, freeze } from './boundary.js';
import type { NormalizedCronV1 } from './contracts.js';

const domains = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]] as const;

function decimal(value: string, path: string): number {
  ensure(/^[0-9]+$/.test(value), `${path}: expected unsigned decimal`);
  const parsed = Number(value); ensure(Number.isSafeInteger(parsed), `${path}: integer out of range`); return parsed;
}

function positiveLiteral(value: string, path: string): bigint {
  ensure(/^[0-9]+$/.test(value), `${path}: expected unsigned decimal`);
  const parsed = BigInt(value); ensure(parsed > 0n, `${path}: step must be positive`); return parsed;
}

function parseField(source: string, index: number): readonly number[] {
  const [minimum, maximum] = domains[index]!;
  ensure(source.length > 0 && !/\s/.test(source), `cron field ${index + 1}: empty or whitespace`);
  const selected = new Set<number>();
  for (const atom of source.split(',')) {
    ensure(atom.length > 0, `cron field ${index + 1}: empty list member`);
    const stepParts = atom.split('/'); ensure(stepParts.length <= 2, `cron field ${index + 1}: malformed step`);
    const base = stepParts[0]!; const step = stepParts[1] === undefined
      ? 1n : positiveLiteral(stepParts[1], `cron field ${index + 1} step`);
    let start: number; let end: number;
    if (base === '*') { start = minimum; end = maximum; }
    else if (base.includes('-')) {
      const range = base.split('-'); ensure(range.length === 2, `cron field ${index + 1}: malformed range`);
      start = decimal(range[0]!, `cron field ${index + 1} range start`);
      end = decimal(range[1]!, `cron field ${index + 1} range end`);
      ensure(start < end, `cron field ${index + 1}: range must ascend`);
    } else {
      ensure(stepParts[1] === undefined, `cron field ${index + 1}: single value cannot carry a step`);
      start = decimal(base, `cron field ${index + 1}`); end = start;
    }
    ensure(start >= minimum && end <= maximum, `cron field ${index + 1}: value outside ${minimum}..${maximum}`);
    const numericStep = step > BigInt(end - start + 1) ? end - start + 1 : Number(step);
    for (let value = start; value <= end; value += numericStep) selected.add(value);
  }
  return freeze([...selected].sort((a, b) => a - b));
}

export function parseCronV1(source: string): NormalizedCronV1 {
  ensure(typeof source === 'string', 'cron-v1 expression must be text');
  const parts = source.split(' '); ensure(parts.length === 5 && parts.every(Boolean), 'cron-v1 requires exactly five space-separated fields');
  const fields = parts.map(parseField) as unknown as NormalizedCronV1['fields'];
  const expression = fields.map(field => field.join(',')).join(' ');
  return freeze({ expression, fields, dayOfMonthUnrestricted: fields[2].length === 31,
    dayOfWeekUnrestricted: fields[4].length === 7 });
}

export function normalizeCronV1(source: unknown, context: BoundaryContext): Result<NormalizedCronV1> {
  return boundary('CronV1Normalization', source, context, () => {
    ensure(typeof source === 'string', 'cron-v1 expression must be text');
    return parseCronV1(source);
  });
}
