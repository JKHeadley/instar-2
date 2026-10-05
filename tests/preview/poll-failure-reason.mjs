export function exhaustedPollReason(failedPolls, conflictedPolls) {
  if (conflictedPolls >= 5) return 'Telegram polling conflict after 5 attempts';
  if (failedPolls >= 20) return 'Telegram polling failed 20 times in a row';
  return null;
}

/** Plan #548: whether a poll-failure episode ends the run. A sustained conflict (another poller holds the bot) and a
 * sustained definite refusal from Telegram (an answer that is not a usable poll result) still end it. A sustained
 * UNREACHABLE connection (no answer at all) does not: the poll breaker stays open at the capped trial cadence while the
 * run keeps doing its due work, which never needs the connection; only delivering a result does. */
export function pollEndsRun(failedPolls, conflictedPolls, unreachable) {
  const reason = exhaustedPollReason(failedPolls, conflictedPolls);
  return reason !== null && unreachable && conflictedPolls < 5 ? null : reason;
}

/** The wait before the next poll attempt: exponential from 250 ms, capped at 2 s for a conflict and 30 s otherwise. */
export const pollBackoffMs = (failedPolls, conflict) => Math.min(conflict ? 2000 : 30000, 250 * 2 ** Math.min(failedPolls - 1, 7));
