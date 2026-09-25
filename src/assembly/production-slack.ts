/** Candidate composition only: a second Part Four port over the installed shared owners. */
import type { BoundaryContext, Refused, Result } from '../index.js';
import { consumeResult } from '../index.js';
import { createFactStore } from '../facts/index.js';
import type { IntakeAdapterPort, IntakeDependencies, IntakePort } from '../intake/index.js';
import { createIntakePort } from '../intake/index.js';
import { createSlackIngress, createSlackIntakeAdapter } from '../conversation/slack.js';
import type { SlackSelection, SlackSocketAuthority } from '../conversation/slack.js';

type Prepared = Readonly<{ intake: IntakePort; adapter: IntakeAdapterPort; ingress: ReturnType<typeof createSlackIngress> }>;

export function prepareSlackIntake(input: Readonly<{
  shared: IntakeDependencies; selection: SlackSelection; socket: SlackSocketAuthority;
  boundary: BoundaryContext; acknowledge(envelopeId: string): Result<void>;
}>) {
  const adapter = createSlackIntakeAdapter(input.selection, input.socket, input.boundary);
  const second = createIntakePort({ ...input.shared, adapter });
  return consumeResult<IntakePort, Refused | Prepared>(second, {
    Refused: refusal => refusal,
    Success: intake => ({ intake, adapter, ingress: createSlackIngress({ selection: input.selection,
      socket: input.socket, intake, facts: createFactStore(input.shared.context(), input.shared.storage),
      observer: input.shared.author.principal.id, boundary: input.boundary,
      acknowledge: input.acknowledge }) }),
  });
}
