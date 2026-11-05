import { registerNativeContextHarness } from './grounding-capability.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { decodeHarnessObservation } from './records.js';
import type { ConfinedContextDeliveryDriverPort } from './context-delivery.js';
import { stallCoverageGaps } from './stall-coverage.js';
import type { HarnessStallCoverage } from './stall-coverage.js';
import type { AssemblyDecodeContext, ContextDeliverySpecification, HarnessAdapterPort, HarnessLaunchSpec, HarnessObservation } from './contracts.js';

export interface NativeHarnessDriverPort {
  readonly owner: 'part-eight';
  launch(input: Readonly<{ operation: string; claim: string; artifact: string; incarnation: string; workingScope: string; handles: readonly string[]; restore?: { operation: string; digest: string; deadline: number } }>): import('../index.js').Result<string>;
  deliver(input: Readonly<{ operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }>): import('../index.js').Result<string>;
  /** Bounded nonempty result from the caller's current delivery, never pane text. */
  observe(input: Readonly<{ operation: string; processIdentity: string; resultAvailable?: boolean }>): import('../index.js').Result<Readonly<{ phase: HarnessObservation['phase']; evidence: string; detail: string; safetyDeadline?: number }>>;
  /** Exact consumer hook for this operation and process; injection alone never acknowledges input. */
  acknowledgement?(input: Readonly<{ operation: string; processIdentity: string }>): import('../index.js').Result<number | null>;
