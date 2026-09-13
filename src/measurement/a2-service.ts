import type { MeasurementDecodeContext } from './decode.js';
import type { MeasurementA2Port } from './a2-contracts.js';
import {
  aggregateCurrentMeasurements, bindCurrentMeasurementReadSource,
  createCurrentBurnWindow, createCurrentQuantityWitness, currentPeerHistoryBinding,
  evaluateCurrentBurn, mergeCurrentPeerMeasurements, renderCurrentMeasurementRead,
  resolveCurrentAttribution, resolveCurrentQuantity,
} from './a2-operations.js';
import { createBoundedReadCache } from './a2-cache.js';

/** Full observational A2 port. It contains no placement, scheduling, or effect authority. */
export function createMeasurementLedgerA2(context: MeasurementDecodeContext): MeasurementA2Port {
  const port: MeasurementA2Port = {
    owner: 'part-sixteen' as const,
    witness: request => createCurrentQuantityWitness(request, context),
    resolve: request => resolveCurrentQuantity(request, context),
    aggregate: request => aggregateCurrentMeasurements(request, context),
    attribute: request => resolveCurrentAttribution(request, context),
    window: request => createCurrentBurnWindow(request, context),
    burn: (policy, previous, current, baselines) =>
      evaluateCurrentBurn(policy, previous, current, baselines, context),
    bindRead: request => bindCurrentMeasurementReadSource(request, context),
    read: request => renderCurrentMeasurementRead(request, context),
    bindPeer: sourceHistory => currentPeerHistoryBinding(sourceHistory, context),
    mergePeers: (peers, policy) => mergeCurrentPeerMeasurements(peers, policy, context),
    cache: policy => createBoundedReadCache(policy, context),
  };
  return Object.freeze(port);
}
