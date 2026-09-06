// The part-eleven slice's conversation service: a Telegram-SHAPED test double with a
// durable, append-only, independently readable journal. It is deliberately NOT the
// Telegram network, a credential holder, or evidence of human delivery. Its declared
// capabilities live in scripts/slice-contracts.json and are the ONLY evidence claims
// the slice is allowed to make about it.
//
// Two readers exist on purpose:
//   * the ADAPTER object handed to part eight (invoke/observe), and
//   * readServiceJournal(), an independent witness reader used to build delivery
//     evidence. The witness never goes through the adapter, so the adapter cannot
//     assert its own application.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';

const lines = file => existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
function appendDurable(file, directory, row) {
  const fd = openSync(file, 'a', 0o600);
  try { writeSync(fd, JSON.stringify(row) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  const dir = openSync(directory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
}

export function serviceDirectory(home) { return join(home, 'service'); }

/** The independent witness. It reads only the service's own durable journal files. */
export function readServiceJournal(home) {
  const directory = serviceDirectory(home);
  return Object.freeze({
    applications: Object.freeze(lines(join(directory, 'applications.jsonl'))),
    charges: Object.freeze(lines(join(directory, 'charges.jsonl'))),
    intents: Object.freeze(lines(join(directory, 'intents.jsonl'))),
    observations: Object.freeze(lines(join(directory, 'observations.jsonl'))),
    inbound: Object.freeze(lines(join(directory, 'inbound.jsonl'))),
  });
}

/**
 * @param home durable slice home
 * @param options.adapter        'telegram-slice' (evidence-complete) or 'telegram-opaque'
 * @param options.quiescenceTicks declared finite quiescence observation window
 * @param options.charge          fixture minor units charged per application
 * @param options.hooks           { beforeApply, afterApply } cut hooks; never load-bearing
 */
export function createSliceService(home, options) {
  const directory = serviceDirectory(home);
  mkdirSync(directory, { recursive: true });
  const applications = join(directory, 'applications.jsonl');
  const charges = join(directory, 'charges.jsonl');
  const intents = join(directory, 'intents.jsonl');
  const observations = join(directory, 'observations.jsonl');
  const inbound = join(directory, 'inbound.jsonl');
  const decisive = options.adapter === 'telegram-slice';
  const quiescenceTicks = options.quiescenceTicks ?? 2;
  const hooks = options.hooks ?? {};
  const journal = () => readServiceJournal(home);
  // Monotone service tick derived from durable journal length; survives restarts.
  const tick = () => { const all = journal(); return all.intents.length + all.applications.length + all.observations.length; };

  const apply = input => {
    const before = journal();
    // The service records the INTENT to apply before the application itself, so a
    // crash between the two is visible to the quiescence observation instead of
    // silently reading as a decisive non-occurrence.
    appendDurable(intents, directory, { operation: input.operation, digest: input.digest, tick: tick() });
    hooks.beforeApply?.(input);
    const already = before.applications.find(r => r.operation === input.operation);
    if (already) {
      if (already.digest !== input.digest) throw new Error('service refuses a changed payload for a recorded operation');
      return already;
    }
    if (before.applications.some(r => r.fenceEpoch > input.fenceEpoch)) throw new Error('service refuses an application below its recorded fence epoch');
    const row = { seq: before.applications.length + 1, operation: input.operation, claim: input.claim, digest: input.digest,
      account: input.account, conversation: input.conversation, semanticMessage: input.semanticMessage,
      text: input.text, messageId: `service-message:${before.applications.length + 1}`,
      fenceEpoch: input.fenceEpoch, tick: tick() };
    appendDurable(applications, directory, row);
    appendDurable(charges, directory, { operation: input.operation, charge: options.charge ?? 1, tick: tick() });
    hooks.afterApply?.(row);
    return row;
  };

  return Object.freeze({
    /** The SAME adapter's inbound side. The conversation delivers this row until the
     *  agent durably receipts it; a pre-receipt crash is an ordinary redelivery. */
    deliverInbound(seed) {
      if (!journal().inbound.length) appendDurable(inbound, directory, { seq: 1, ...seed });
      const row = journal().inbound[0];
      return { raw: row.raw, route: { channel: row.channel, sender: row.sender, identityEpoch: row.identityEpoch, eventId: row.eventId } };
    },
    adapter: options.adapter,
    decisive,
    quiescenceTicks,
    tick,
    journal,
    apply,
    /** One bounded read-only quiescence observation. Durable, so the declared
     *  finite window is measured on the service's own monotone tick, and an
     *  unbounded number of observations cannot be hidden. */
    observeQuiescence(operation) {
      appendDurable(observations, directory, { operation, tick: tick() });
      return { lookup: this.lookup(operation), quiescence: this.quiescence(operation) };
    },
    /** Bounded read-only query. No create-if-missing, no invocation, no claim. */
    lookup(operation) {
      const all = journal();
      const row = all.applications.find(r => r.operation === operation);
      if (row) return { status: 'applied', row, charge: all.charges.find(c => c.operation === operation)?.charge ?? null };
      if (!decisive) return { status: 'unknown', reason: 'this adapter declares no authoritative receipt lookup' };
      const intent = all.intents.filter(r => r.operation === operation).at(-1);
      if (intent && tick() - intent.tick < quiescenceTicks) return { status: 'in-flight', observedThrough: tick(), quiescentAt: intent.tick + quiescenceTicks };
      return { status: 'not-applied', observedThrough: tick(), complete: true };
    },
    /** Declared finite quiescence observation. Unsupported adapters answer null. */
    quiescence(operation) {
      if (!decisive) return null;
      const all = journal();
      const last = [...all.intents.filter(r => r.operation === operation), ...all.applications.filter(r => r.operation === operation)].map(r => r.tick).sort((a, b) => a - b).at(-1);
      if (last === undefined) return { quiescent: true, observedThrough: tick(), reason: 'no recorded intake' };
      return { quiescent: tick() - last >= quiescenceTicks, observedThrough: tick(), quiescentAt: last + quiescenceTicks };
    },
    finalCharge(operation) {
      if (!decisive) return null;
      const row = journal().charges.find(c => c.operation === operation);
      return row ? row.charge : null;
    },
  });
}
