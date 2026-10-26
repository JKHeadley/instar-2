// Seven's existing adapter owns no-retry dispatch; its capture port owns the audit.
// Ten supplies current Six claims and release admission. No credential enters here.
import { consumeResult } from '../dist/index.js';
import { createModelAdapter } from '../dist/judgment/index.js';
import { TEMPLATE, digest } from './setup-qualification.mjs';
import { PROMPT, projectSetupChecks } from './setup-supervisor-protocol.mjs';
const value = result => consumeResult(result, { Success: v => v, Refused: () => { throw Error('setup owner refused'); } });
export function renderSetupRequest(record) {
  const projection = projectSetupChecks(record, record.checkpoint);
  return TEMPLATE.replace('{system}', () => PROMPT).replace('{task}', () => JSON.stringify(projection));
}
/** claim(bytes, capture) returns an actual ModelExchange from the existing Six
 * authority (not a fabricated grant). captures is Seven's JudgmentCapturePort.
 * physical has admit() and execute(); no provider fallback exists.
 */
export function setupSevenRoute({ authority, host, context, captures, claim, physical }) {
  let active = false;
  return Object.freeze({
    admit: input => physical.admit(input),
    async validate(record, options) {
      if (active) throw Error('setup validation already active');
      active = true;
      let slot, calls = 0;
      try {
        const prompt = renderSetupRequest(record);
        let measured;
        const description = { owner: 'part-ten', provider: 'llama.cpp-b4000', model: 'Qwen2.5-3B-Instruct-Q4_K_M',
          route: 'setup-local', automaticRetries: 0, maxInputBytes: 16384, maxOutputBytes: 65536,
          maxCharge: 0, measured: false, basis: 'distribution remains held until exact host and installed-owner qualification' };
        const adapter = value(createModelAdapter(description, { automaticRetries: 0, execute: async send => { await send(); } },
          async (submitted, operation) => {
            const wire = JSON.parse(submitted);
            if (wire.input.prompt !== prompt || wire.input.checkpointDigest !== digest(JSON.stringify(record))) throw Error('setup request changed');
            calls++;
            measured = await physical.execute({ record, prompt, ...options });
            return { state: measured.state, bytes: measured.bytes, providerOperation: operation,
              usage: measured.usage, retryBlocked: false };
          }, authority, host, context));
        const bytes = value(adapter.prepare({ prompt, checkpointDigest: digest(JSON.stringify(record)) }));
        const request = value(captures.put(bytes, 16384));
        // Reserve full raw response + accounting before the model can run.
        slot = value(captures.reserve(4 * 1048576));
        const exchange = await claim(bytes, request);
        const observation = value(await adapter.exchange({ ...exchange, bytes }));
        const capture = value(captures.putReserved(slot, JSON.stringify({ request, record, observation,
          accounting: measured?.accounting ?? null, cleanup: measured?.cleanup ?? 'unknown', calls })));
        return { state: observation.state, bytes: observation.bytes, usage: observation.usage, capture,
          cleanup: calls === 1 ? measured?.cleanup ?? 'unknown' : 'unknown' };
      } catch (error) {
        // No physical invocation: return only unused capacity through its owner.
        // The owner refuses bound slots; request and transport evidence stay intact.
        if (slot && calls === 0) value(captures.releaseReserved(slot));
        throw error;
      } finally { active = false; }
    },
  });
}
