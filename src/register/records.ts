import { checked, requireThat, take } from './boundary.js';
import { decodeGenerationRecord } from './generator.js';
import { decodeCheckRun } from '../rulegraph/graph.js';
import type { RegisterContext } from './types.js';

// P3 publishes BODY registrations. P2 owns envelope admission and its registry.
export function registeredFactSchemas(context: RegisterContext) { return context.shape.factSchemas; }
export function decodeRegisteredFact(kind: string, input: unknown, context: RegisterContext) {
  return checked('RegisteredFactDispatch', { kind, input }, context, () => {
    const registration = context.shape.factSchemas.find(r => r.kind === kind);
    requireThat(registration, `unregistered fact kind ${kind}`);
    if (registration.decoder === 'decodeGenerationRecord') return take(decodeGenerationRecord(input, context));
    requireThat(registration.decoder === 'decodeCheckRun', 'unknown P3 fact decoder');
    return take(decodeCheckRun(input, context));
  });
}
