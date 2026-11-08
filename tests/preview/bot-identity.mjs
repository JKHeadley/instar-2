import { temporaryPollStatus } from './poll-failure-reason.mjs';

/** getme-restart-1108: the launch-time bot identity check (getMe) waits out a slow or briefly failing Telegram
 * instead of refusing the launch. On 2026-11-08 (01:19-01:25) three relaunches in a row were refused "bot identity
 * refused" while getMe took 21 s once and answered 504 once, so a routine restart kept the agent offline for minutes.
 * getMe is a read: repeating it sends nothing. The bound is three tries within 90 s in total. */
export const BOT_IDENTITY_RETRY = Object.freeze({ tries: 3, totalMs: 90000, tryMs: 30000, minTryMs: 5000,
  backoffMs: Object.freeze([2000, 5000]) });

/** Transport outcomes where Telegram gave no answer, or a child that may not have finished asking. */
const NO_ANSWER_STAGES = new Set(['fetch-timeout', 'fetch-failure', 'body-read', 'child-exit', 'spawn-refused', 'launch-refused']);

/** 'verified': Telegram named the bound bot. 'temporary': no answer, or a temporary server failure (5xx, 429), so
 * the same question may be asked again. 'refused': a definite answer that this launch must not run on: another bot,
 * a malformed answer, or a token refusal (401, 404 and every other 4xx). */
export function botIdentityOutcome(answer, boundId) {
  if (answer?.kind === 'identity') return answer.identity?.id === boundId ? 'verified' : 'refused';
  if (answer?.kind !== 'uncertain') return 'refused';
  if (answer.stage === 'invalid-response') return temporaryPollStatus(answer.status) ? 'temporary' : 'refused';
  return NO_ANSWER_STAGES.has(answer.stage) ? 'temporary' : 'refused';
}

/** A short label for the launch log: the stage and HTTP status only, never a body. */
export const botIdentityLabel = answer => answer?.kind === 'identity' ? `bot ${answer.identity?.id}`
  : `${answer?.stage ?? answer?.kind ?? 'no answer'}${Number.isInteger(answer?.status) ? ` HTTP ${answer.status}` : ''}`;

/** Asks getMe until it is verified or definitely refused, within the policy's tries and total time. `invoke(timeoutMs)`
 * asks once; `elapsed()` is a monotonic clock in ms; `wait(ms)` pauses; `stopped()` is the operator stop or a signal,
 * checked after every pause; `retrying(label, ms)` reports a temporary failure before the pause. The clock may be
 * fractional (performance.now), so each try's timeout is floored to whole ms: spawnSync and the bridge take integers. */
export async function verifyBotIdentity({ invoke, boundId, elapsed, wait, stopped, retrying = () => {}, policy = BOT_IDENTITY_RETRY }) {
  const started = elapsed(), attempts = [];
  for (let attempt = 0; attempt < policy.tries; attempt++) {
    if (attempt > 0) {
      const pause = policy.backoffMs[Math.min(attempt - 1, policy.backoffMs.length - 1)];
      if (policy.totalMs - (elapsed() - started) - pause < policy.minTryMs) break;
      retrying(attempts.at(-1), pause);
      await wait(pause);
      if (stopped()) return { outcome: 'stopped', attempts };
    }
    const answer = invoke(Math.floor(Math.min(policy.tryMs, policy.totalMs - (elapsed() - started))));
    attempts.push(botIdentityLabel(answer));
    const outcome = botIdentityOutcome(answer, boundId);
    if (outcome !== 'temporary') return { outcome, answer, attempts };
  }
  return { outcome: 'exhausted', attempts };
}
