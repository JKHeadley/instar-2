// One fresh, one-use process under the existing host owner. No model bytes are
// supplied speculatively. The caller owns confinement preparation and disposal.
import { hostResources } from './resource-owner.mjs';

const binding = input => JSON.stringify([input.executable, input.args, input.cwd, input.env, input.maxBytes]);

export function prestartProvider(input, { owner = hostResources, idleMs = 30000, initialInput = '' } = {}) {
  if (!Number.isSafeInteger(idleMs) || idleMs <= 0 || idleMs > 30000
    || !Number.isSafeInteger(input.timeout) || input.timeout <= 0) throw Error('prestart: invalid lifetime');
  let deliver, cancelled = false, consumed = false, ended = false;
  const deferredInput = new Promise(resolve => { deliver = resolve; });
  const stopped = () => cancelled || input.stopped?.() === true;
  const result = owner.execute({ ...input, stdin: '', initialInput, deferredInput,
    timeout: idleMs + input.timeout, stopped }, 'maintenance');
  const idle = setTimeout(() => { cancelled = true; deliver(''); }, idleMs);
  const settled = result.finally(() => { ended = true; clearTimeout(idle); });
  // Observe rejection while idle too; consumption/cancellation still sees the original failure.
  void settled.catch(() => {});
  const expected = binding(input);
  return Object.freeze({
    matches(next) { return !ended && !consumed && !stopped() && expected === binding(next); },
    consume(next) {
      if (ended || consumed || stopped() || expected !== binding(next)
        || !Number.isSafeInteger(next.timeout) || next.timeout <= 0 || next.timeout > input.timeout) return null;
      consumed = true; clearTimeout(idle);
      const deadline = setTimeout(() => { cancelled = true; }, next.timeout);
      deliver(next.stdin);
      return settled.then(outcome => outcome.resources?.cleanup === 'unresolved' ? { ...outcome, limited: true } : outcome)
        .finally(() => clearTimeout(deadline));
    },
    async close() {
      cancelled = true; clearTimeout(idle); deliver('');
      const outcome = await settled;
      if (outcome.resources?.cleanup === 'unresolved') throw Error('prestart: previous process cleanup is unresolved');
      return outcome;
    },
  });
}
