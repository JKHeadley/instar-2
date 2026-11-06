/** Cartographer's production owner composition. No private timer or model route. */
import { createAwareness } from '../awareness/index.js';
import type { AwarenessConfig } from '../awareness/index.js';
import { createCartographer } from '../recall/cartographer/index.js';
import type { CartographerConfig } from '../recall/cartographer/index.js';
import { createProductionCartographerSource } from './production-cartographer-source.js';
import { ensure } from './boundary.js';

export interface ProductionCartographerInput {
  readonly source: Parameters<typeof createProductionCartographerSource>[0];
  readonly service: Omit<CartographerConfig, 'source'>;
  readonly awareness: Omit<AwarenessConfig, 'recall' | 'now' | 'stopped'>;
}
export function composeProductionCartographer(input: ProductionCartographerInput) {
  ensure(input.service.topic === input.source.topic, 'Cartographer source/consumer topic differs');
  const source = createProductionCartographerSource(input.source);
  const cartographer = createCartographer({ ...input.service, source });
  const awareness = createAwareness({ ...input.awareness, recall: cartographer.recall,
    now: input.service.now, stopped: input.service.stopped });
  return Object.freeze({ cartographer, awareness });
}
