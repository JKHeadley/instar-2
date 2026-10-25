/** OS-neutral custody boundary, deliberately separate from broker business logic.
 * install(material): authenticate the entire distribution then place immutable files.
 * verify(): recheck installed bytes, ownership, modes and the three distinct identities.
 * start(): start only verified material, as the broker identity, never as agent/harness.
 * request(scopedRequest): bounded harmless request through the existing custody reader.
 * status(): observed stopped/running/refused; a declaration is never proof of running.
 * stop(): stop the exact process this instance started and wait for its exit.
 *
 * Platform conformance additionally probes both agent and harness: replacement of
 * files/directories, reading key material, elevation into the broker, and administrative
 * control must fail. These are real OS probes, not booleans supplied by an implementation.
 * No genesis, key generation, pairing, standing grant, paid call or external send occurs.
 */
export function custodyPlatform(implementation) {
  for (const operation of ['install', 'verify', 'start', 'request', 'status', 'stop'])
    if (typeof implementation[operation] !== 'function') throw Error(`custody platform missing ${operation}`);
  return Object.freeze(implementation);
}
