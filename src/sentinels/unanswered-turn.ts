import type { ProviderFailureClass } from '../assembly/provider-failure.js';

export interface UnansweredTurn {
  readonly id: string; readonly recordedAt: number; readonly disposition: string; readonly phase: string;
  readonly held: boolean; readonly failureClass?: ProviderFailureClass; readonly resetHint?: string | null;
}

export function decideUnansweredTurn(input: Readonly<{ turns: readonly UnansweredTurn[]; stopped: boolean; expiresAt: number }>,
  now: number): Readonly<{ turnId: string; text: string }> | null {
  if (input.stopped || now >= input.expiresAt) return null;
  const turn = input.turns.filter(row => row.held && row.disposition === 'admitted-bound'
    && ['intake-preserved', 'grounded'].includes(row.phase)
    && Number.isSafeInteger(row.recordedAt) && now - row.recordedAt >= 180000)
    .sort((a, b) => a.recordedAt - b.recordedAt || a.id.localeCompare(b.id))[0];
  if (!turn) return null;
  const reason = turn.failureClass === 'limit'
    ? `hit my usage limit${turn.resetHint ? `, which resets ${turn.resetHint}` : ''}`
    : turn.failureClass === 'policy' ? 'hit a provider policy block'
      : turn.failureClass === 'timeout' ? 'timed out'
        : turn.failureClass === 'transport' ? 'lost the provider connection'
          : 'could not complete the answer';
  return { turnId: turn.id, text: `I got your message but ${reason}. I couldn't answer this turn.` };
}
