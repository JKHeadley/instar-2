import type { DecodeContext } from '../types/ports.js';
import type { Clock, Intent, Result, UnresolvedInput } from '../types/values.js';
import { consumeResult } from '../types/internal.js';
import { decode } from './decode.js';

// The actual adapter and binding decoder belong to part four. This fallback preserves reachability.
export function decodeIntake(input: unknown, fallback: { raw: string; channel: string; at: Clock }, context: DecodeContext): Result<Intent | UnresolvedInput> {
  const result = decode('Intent', input, context);
  return consumeResult<Intent, Result<Intent | UnresolvedInput>>(result, {
    Success: () => result,
    Refused: r => decode('UnresolvedInput', { type: 'UnresolvedInput', schemaVersion: 1, ...fallback, reason: r.detail }, context),
  });
}
