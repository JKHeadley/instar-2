/** Rule 28/29/114: authenticated transport is requester intake, never a grant.
 * Four preserves the sealed frame before this adapter opens it. The same custody
 * verifier serves transport and intake, so a name inside the task cannot become
 * the sending principal. All writes use Four/Ten's existing capture and spine. */
import type { BoundaryContext, Clock } from '../index.js';
import type { IntakeAdapterPort, IntakeCapturePort, InboundRoute } from '../intake/index.js';
import type { AgentTransportEnvelope } from '../rungraph/index.js';
import type { ThreadlineFrame, ThreadlineKeys } from './threadline.js';
import { openThreadlineFrame } from './threadline.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

export const threadlineParserDeclarationId = 'threadline-intake-v1';
export const threadlineAuthenticationMethod = 'threadline-sealed-sender';
export interface ThreadlineIntakeConfig {
  readonly keys: ThreadlineKeys;
  readonly capture: IntakeCapturePort;
  readonly machine: string;
  /** Current enrolled peer epoch, read from the existing key custodian. */
  epoch(principal: string): string | null;
  readonly context: BoundaryContext;
}

export function threadlineIntakeRoute(frame: ThreadlineFrame, epoch: string): InboundRoute {
  return freeze({ channel: `threadline:${frame.conversation}`, sender: frame.sender,
    // Four accounts for physical arrivals; Five retains logical-key dedup.
    // Re-sealed delivery attempts have different raw bytes and must not be
    // falsely treated as a raw-hash collision at Four's receipt boundary.
    identityEpoch: epoch, eventId: encoded([frame.key, frame.attempt]).bytes });
}

export function createThreadlineIntakeAdapter(input: ThreadlineIntakeConfig): IntakeAdapterPort {
  // Single synchronous Four receive transaction. Authentication must precede
  // parse; no retained capability survives another call or an epoch change.
  let authenticated: Readonly<{ raw: string; envelope: AgentTransportEnvelope; epoch: string }> | undefined;
  return freeze({ id: threadlineParserDeclarationId,
    authenticate(raw: string, route: InboundRoute, at: Clock) {
      authenticated = undefined;
      return boundary('ThreadlineIntakeAuthentication', { route }, input.context, () => {
        ensure(raw.length <= 262144, 'Threadline frame exceeds intake bound');
        const frame = JSON.parse(raw) as ThreadlineFrame;
        const opened = openThreadlineFrame(input.keys, frame);
        ensure(typeof opened !== 'string' && frame.kind === 'envelope' && opened.envelope
          && opened.receipt === null, 'Threadline authenticated message required');
        const epoch = input.epoch(frame.sender);
        ensure(epoch && encoded(route).bytes === encoded(threadlineIntakeRoute(frame, epoch)).bytes,
          'Threadline sender, conversation, semantic key or current key epoch differs');
        const principal = { id: frame.sender, kind: 'agent' as const };
        const record = take(input.capture.preserve(encoded({ principal,
          recordType: 'threadline-authenticated-sender', payload: principal }).bytes, at));
        authenticated = { raw, envelope: opened.envelope, epoch };
        return { principalId: principal.id, principalKind: principal.kind,
          channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch,
          provenance: { type: 'Provenance' as const, schemaVersion: 1 as const,
            adapter: threadlineParserDeclarationId, method: threadlineAuthenticationMethod,
            record, verifiedAt: at, machine: input.machine,
            // Ten attests the verified channel. This is deliberately NOT an
            // independently signed P1 approval or a foreign grant import.
            evidence: { kind: 'channel' as const, authenticated: true } } };
      });
    },
    parse(raw: string) {
      const admitted = authenticated; authenticated = undefined;
      ensure(admitted && admitted.raw === raw && input.epoch(admitted.envelope.sender) === admitted.epoch,
        'Threadline bytes were not authenticated under the current peer epoch');
      return { schemaVersion: 1, kind: 'message', text: encoded(admitted.envelope).bytes };
    } });
}
