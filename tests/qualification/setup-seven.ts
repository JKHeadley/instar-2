import { canonical } from '../../src/index.js';
import { createModelAdapter } from '../../src/judgment/index.js';
import { transportFixture } from '../transport/fixture.js';
import { value } from '../facts/fixtures.js';
// @ts-expect-error Physical Seven capture port.
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
// @ts-expect-error Physical qualification adapter.
import { validateTask, renderTask, MODEL_3B } from '../../scripts/setup-qualification.mjs';

/** Real local invocation through Seven's existing no-retry adapter and Six claim.
 * This qualification does not issue a Decision, standing, GE or A0. */
export async function observeSetup(input: Parameters<typeof validateTask>[0]) {
  const f = transportFixture(input.root);
  const captures = createJudgmentCaptures(input.root, {}, f.result, 1048576, f.ctx.decode.captures);
  const description = { owner: 'part-ten' as const, provider: 'llama.cpp-b4000',
    model: input.model === MODEL_3B ? 'Qwen2.5-3B-Instruct-Q4_K_M' : 'Qwen2.5-1.5B-Instruct-Q4_K_M', route: 'route', automaticRetries: 0 as const,
    maxInputBytes: 16384, maxOutputBytes: 65536, maxCharge: 0, measured: false as const,
    basis: 'unqualified macOS CPU candidate; isolated qualification only; no installation authority' };
  let measured: Awaited<ReturnType<typeof validateTask>> | undefined;
  let calls = 0;
  const model = value(createModelAdapter(description, { automaticRetries: 0, execute: async send => { await send(); } },
    async (submitted, operation) => {
      calls++;
      const wire = JSON.parse(submitted);
      if (wire.input.prompt !== renderTask(input.task)) throw Error('Seven submission differs from actual prompt');
      measured = await validateTask(input);
      return { state: measured.disposition === 'observed' ? 'complete' : 'uncertain', bytes: measured.output,
        providerOperation: operation, usage: measured.usage, retryBlocked: false };
    }, f.api, f.host, f.c));
  const submitted = value(model.prepare({ prompt: renderTask(input.task), task: input.task.id }));
  const requestCapture = value(captures.put(submitted, 16384));
  const fence = value(f.api.acquire('qualification', '', 500));
  value(f.api.schedule('qualification-schedule', fence, f.run, f.policy));
  const reservation = value(f.api.reserve(f.input(fence, { payloadDigest: value(canonical(submitted)).hash, charge: 0 })));
  const claim = value(f.api.claim('qualification-claim', fence, reservation.operation));
  const observation = value(await model.exchange({ claim, fence, bytes: submitted, deadline: 400, incarnation: f.host.incarnation,
    recordDispatch: () => f.result(() => undefined) }));
  const responseCapture = value(captures.put(JSON.stringify(observation), 131072));
  if (!measured || calls !== 1) throw Error('qualification must make exactly one admitted call');
  const accountingCapture = value(captures.put(JSON.stringify({ verdict: measured.verdict,
    elapsedMs: measured.elapsedMs, loadMs: measured.loadMs, usage: measured.usage, resources: measured.raw.resources }), 65536));
  return { ...measured, seven: { requestCapture, responseCapture, accountingCapture, calls,
    operation: reservation.operation, provider: description.provider, model: description.model } };
}
