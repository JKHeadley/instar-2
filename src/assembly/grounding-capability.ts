import type { GroundingReadPort } from '../rungraph/index.js';

const productionGroundingReaders = new WeakMap<object, string>();
const productionGroundingReads = new WeakMap<object, Readonly<{ reader: GroundingReadPort; invocation: object }>>();

/** Private Ten/Five construction capability. This module is deliberately not
 * exported from either package index, so public registration cannot mint it. */
export function issueProductionGroundingReader<T extends GroundingReadPort>(reader: T, scope: string): T {
  if (!scope.trim()) throw new Error('production grounding scope required');
  productionGroundingReaders.set(reader, scope);
  return reader;
}

export function productionGroundingReaderScope(reader: GroundingReadPort): string | undefined {
  return productionGroundingReaders.get(reader);
}

export function issueProductionGroundingRead(reader: GroundingReadPort, invocation: object, grounding: unknown): unknown {
  if (!productionGroundingReaders.has(reader)) throw new Error('production grounding reader was not factory-issued');
  const result = Object.freeze({ invocation, grounding });
  productionGroundingReads.set(result, { reader, invocation });
  return result;
}

export function consumeProductionGroundingRead(reader: GroundingReadPort, invocation: object, result: unknown): unknown {
  if (!result || typeof result !== 'object' || productionGroundingReads.get(result)?.reader !== reader
    || productionGroundingReads.get(result)?.invocation !== invocation)
    throw new Error('production grounding read was pre-completed or replayed outside this invocation');
  return (result as Readonly<{ grounding: unknown }>).grounding;
}
