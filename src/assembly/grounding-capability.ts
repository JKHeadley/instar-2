import type { GroundingReadPort, RunGraphPort } from '../rungraph/index.js';
import type { FactStorePort } from '../facts/index.js';
import type { AssemblyComposition, AssemblyHistoryReadPort, AssemblyRuntimePort, HarnessAdapterPort } from './contracts.js';

interface RuntimeOrigin {
  readonly composition: AssemblyComposition;
  readonly history: AssemblyHistoryReadPort;
  readonly store: FactStorePort;
  readonly host: AssemblyComposition['host'];
  readonly spine: AssemblyComposition['spine'];
}
interface ReaderOrigin extends RuntimeOrigin {
  readonly runtime: AssemblyRuntimePort;
  readonly harness: HarnessAdapterPort;
  readonly scope: string;
  readonly generation: string;
}
const runtimes = new WeakMap<object, RuntimeOrigin>();
const drivers = new WeakMap<object, { runtime: AssemblyRuntimePort; history: AssemblyHistoryReadPort }>();
const harnesses = new WeakMap<object, { runtime: AssemblyRuntimePort; history: AssemblyHistoryReadPort; driver: object }>();
const readers = new WeakMap<object, ReaderOrigin>();
const declaredReaders = new WeakSet<object>();
export function isDeclaredFactoryReader(reader: GroundingReadPort): boolean { return declaredReaders.has(reader); }
const graphs = new WeakMap<object, ReaderOrigin>();
const reads = new WeakMap<object, { reader: GroundingReadPort; invocation: object }>();
const deliveries = new WeakMap<object, { driver: object; specification: string }>();

export function registerAssemblyRuntime(runtime: AssemblyRuntimePort, composition: AssemblyComposition, history: AssemblyHistoryReadPort): void {
  runtimes.set(runtime, { composition, history, store: composition.spine.store, host: composition.host, spine: composition.spine });
}
export function runtimeOrigin(runtime: AssemblyRuntimePort): RuntimeOrigin | undefined { return runtimes.get(runtime); }
export function registerContextDriver(driver: object, runtime: AssemblyRuntimePort, history: AssemblyHistoryReadPort): void {
  const origin = runtimes.get(runtime);
  if (origin && origin.history === history) drivers.set(driver, { runtime, history });
}
export function registerNativeContextHarness(harness: HarnessAdapterPort, driver: object, history: AssemblyHistoryReadPort): void {
  const origin = drivers.get(driver);
  if (origin && origin.history === history) harnesses.set(harness, { ...origin, driver });
}
export function issueContextDeliveryExecution(observation: object, driver: object, specification: string): void {
  if (drivers.has(driver)) deliveries.set(observation, { driver, specification });
}
export function consumeContextDeliveryExecution(harness: HarnessAdapterPort, observation: object, specification: string): boolean {
  const origin = harnesses.get(harness), executed = deliveries.get(observation);
  deliveries.delete(observation);
  return !!origin && executed?.driver === origin.driver && executed.specification === specification;
}
/** A string declaration never certifies owners. Only the connected native path
 * can receive a capability, bound to this store, scope and current generation. */
export function issueProductionGroundingReader<T extends GroundingReadPort>(reader: T, scope: string,
  runtime?: AssemblyRuntimePort, harness?: HarnessAdapterPort): T {
  declaredReaders.add(reader);
  const origin = runtime && runtimes.get(runtime), native = harness && harnesses.get(harness);
  if (scope.trim() && origin && native && native.runtime === runtime && native.history === origin.history
    && origin.composition.harnesses.includes(harness!) && !origin.composition.host.current().stopped) {
    readers.set(reader, { ...origin, runtime: runtime!, harness: harness!, scope,
      generation: origin.composition.host.current().generation });
  }
  return reader;
}
function current(origin: ReaderOrigin | undefined): origin is ReaderOrigin {
  return !!origin && origin.composition.spine === origin.spine && origin.composition.host === origin.host
    && origin.spine.store === origin.store && !origin.host.current().stopped
    && origin.composition.host.current().generation === origin.generation
    && origin.composition.harnesses.includes(origin.harness)
    && runtimes.get(origin.runtime)?.history === origin.history;
}
export function productionGroundingReaderScope(reader: GroundingReadPort): string | undefined {
  const origin = readers.get(reader); return current(origin) ? origin.scope : undefined;
}
export function bindProductionGroundedGraph<T extends RunGraphPort>(graph: T, reader: GroundingReadPort,
  store: FactStorePort, history: AssemblyHistoryReadPort | undefined, generation: string): T {
  const origin = readers.get(reader);
  if (current(origin) && origin.store === store && origin.history === history
    && origin.generation === generation) graphs.set(graph, origin);
  return graph;
}
export function productionGraphScope(graph: RunGraphPort): string | undefined {
  const origin = graphs.get(graph); return current(origin) ? origin.scope : undefined;
}
export function productionGraphMatches(graph: RunGraphPort, composition: AssemblyComposition, scope: string): boolean {
  const origin = graphs.get(graph);
  return current(origin) && origin.scope === scope && origin.store === composition.spine.store
    && origin.host === composition.host && composition.harnesses.includes(origin.harness)
    && origin.generation === composition.host.current().generation;
}
export function issueProductionGroundingRead(reader: GroundingReadPort, invocation: object, grounding: unknown): unknown {
  if (!productionGroundingReaderScope(reader)) throw new Error('production grounding reader has no current factory provenance');
  const result = Object.freeze({ invocation, grounding }); reads.set(result, { reader, invocation }); return result;
}
export function consumeProductionGroundingRead(reader: GroundingReadPort, invocation: object, result: unknown): unknown {
  if (!result || typeof result !== 'object' || reads.get(result)?.reader !== reader || reads.get(result)?.invocation !== invocation)
    throw new Error('production grounding read was pre-completed or replayed outside this invocation');
  reads.delete(result);
  return (result as Readonly<{ grounding: unknown }>).grounding;
}
