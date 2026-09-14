import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  canonical,
  consumeResult,
  decode,
  decodeMeasurement,
  defineDecoder,
  deriveThrough,
} from '../src/index.js';
import {
  createFactStore,
  factId,
  genesisHash,
  signEnvelope,
} from '../src/facts/index.js';
import {
  decodeHarnessAdapterStateSnapshot,
  harnessAdapterIdentity,
} from '../src/harness-adapters/index.js';
import { createTransportFileStorage } from './transport-file-storage.mjs';

const STATE_KIND = 'harness-adapter-state';
const STATE_SITE = 'harness-adapter-state.storage';
const MAX_STATE_BYTES = 16 * 1024 * 1024;

function take(result) {
  return consumeResult(result, {
    Success: value => value,
    Refused: refusal => { throw new Error(`${refusal.site}: ${refusal.detail}`); },
  });
}

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function encoded(value) {
  return take(canonical(value));
}

function deterministicAuthor(path) {
  // This reference composition has no credential authority. Its per-store key
  // authenticates package-local journal bytes for Part Two and is derived from
  // the local store identity; it is not a deployable account or secret value.
  const seed = createHash('sha256').update(`p13-state-fact:${resolve(path)}`).digest('hex');
  const key = createPrivateKey({
    key: Buffer.from(`302e020100300506032b657004220420${seed}`, 'hex'),
    format: 'der',
    type: 'pkcs8',
  });
  const privateKey = key.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicKey = createPublicKey(key).export({ format: 'pem', type: 'spki' }).toString();
  const machine = `p13-state-${seed.slice(0, 16)}`;
  const keyId = `${machine}-key`;
  const register = {
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: `generation:${machine}` },
    entries: [STATE_SITE, 'host', 'probe', machine, 'p13-state-project', 'signed-envelope'],
    producers: ['probe', 'host'],
    methods: ['signed-envelope', 'fact-envelope'],
    actions: { work: { protected: false, repository: false } },
    subjects: { clock: ['unix-ms'] },
    sites: { [STATE_SITE]: 'closed' },
    keys: {
      [keyId]: {
        algorithm: 'ed25519', owner: machine, publicKey,
        methods: ['signed-envelope', 'fact-envelope'], adapters: ['host'],
      },
    },
    allowRedelegation: false,
    conflictStanding: { ordinary: 'delegate', authority: 'operator' },
  };
  const captureBytes = {};
  const decodeContext = {
    site: STATE_SITE, register, preserved: `journal:${seed}`, captures: captureBytes,
    principals: [], grants: [], revocations: [], authorizations: [], directives: [], evidence: [],
    recordSubjects: {},
  };
  const at = Date.now();
  const clockInput = {
    type: 'Measurement', schemaVersion: 1,
    subject: { kind: 'clock', instance: machine }, value: at, unit: 'unix-ms', at, by: 'probe',
  };
  const clock = take(decodeMeasurement('clock', clockInput, decodeContext));
  const actor = { id: machine, kind: 'system' };
  const recordBytes = encoded({ principal: actor, recordType: 'identity', payload: actor }).bytes;
  const recordReference = `record:${encoded(recordBytes).hash}`;
  const recordHash = `sha256:${createHash('sha256').update(recordBytes).digest('hex')}`;
  captureBytes[recordReference] = recordBytes;
  const provenance = take(decode('Provenance', {
    type: 'Provenance', schemaVersion: 1, adapter: 'host', method: 'signed-envelope',
    record: { reference: recordReference, hash: recordHash }, verifiedAt: clock, machine,
    evidence: { kind: 'signature', keyId, signature: sign(null, Buffer.from(recordBytes), key).toString('hex') },
  }, decodeContext));
  const principal = take(decode('VerifiedPrincipal', {
    type: 'VerifiedPrincipal', schemaVersion: 1, id: actor.id, kind: actor.kind,
  }, { ...decodeContext, provenance }));
  decodeContext.principals.push(principal);
  const scope = take(decode('Scope', {
    type: 'Scope', schemaVersion: 1, kind: 'project', members: ['p13-state-project'],
  }, decodeContext));
  const context = {
    site: STATE_SITE,
    preserved: decodeContext.preserved,
    decode: decodeContext,
    schemas: [{
      kind: STATE_KIND, version: 1,
      fields: {
        stateId: { kind: 'text', maxLength: 4096 },
        canonicalHash: { kind: 'text', maxLength: 71 },
        snapshot: { kind: 'text', maxLength: MAX_STATE_BYTES },
      },
      machineScope: 'shared', standing: 'requester', action: 'work', scope,
      causallyBound: false, requiredReferences: [], authority: 'none',
    }],
    keys: [{ id: keyId, machine, publicKey, from: { epoch: 0, position: 0 } }],
    facts: [], grants: [], revocations: [], genesis: { hash: genesisHash, clock },
    timeAnchors: [], captures: {}, folded: {},
  };
  return { context, decodeContext, machine, principal, provenance, privateKey, clock };
}

function receiptBoundary(author) {
  const boundary = { site: STATE_SITE, preserved: author.context.preserved, register: author.decodeContext.register };
  return run => {
    const decoder = take(defineDecoder({
      name: 'HarnessAdapterStateStorageReceipt', owner: 'part-thirteen', currentVersion: 1,
      versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
      decodeCurrent: () => {
        try { return { ok: true, value: run() }; }
        catch (error) { return { ok: false, detail: error instanceof Error ? error.message : String(error) }; }
      },
    }, boundary.preserved));
    return deriveThrough(decoder, {
      type: 'HarnessAdapterStateStorageReceipt', schemaVersion: 1,
    }, boundary);
  };
}

function ownerStorageUncertain(directory) {
  return existsSync(join(directory, 'append.lock')) || existsSync(join(directory, 'facts.pending'));
}

function legacySnapshot(path) {
  if (!existsSync(path)) return null;
  try {
    if (!lstatSync(path).isFile()) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('Part Two harness state legacy import is unreadable');
  }
}

/**
 * Thin A2 composition over Part Two's fact store and the landed transport-file
 * storage adapter. The transport adapter's abandoned append lock is preserved
 * as persistent uncertainty; A2 neither repairs nor deletes owner files.
 */
export function createHarnessAdapterFileState(path) {
  if (!path) throw new Error('harness adapter state path is required');
  const directory = `${path}.part-two`;
  const author = deterministicAuthor(path);
  const base = createTransportFileStorage(directory, receiptBoundary(author));
  const storage = Object.freeze({
    ...base,
    read() {
      if (ownerStorageUncertain(directory)) {
        throw new Error('Part Two harness state append is uncertain');
      }
      return base.read();
    },
  });
  const store = createFactStore(author.context, storage);
  const stateId = `file:${resolve(path)}`;

  const current = () => {
    const facts = take(store.read());
    if (facts.some(fact => fact.kind !== STATE_KIND || fact.body.stateId !== stateId)) {
      throw new Error('Part Two harness state contains a foreign fact');
    }
    const fact = facts.at(-1) ?? null;
    if (!fact) return { fact: null, snapshot: null, canonicalHash: null };
    const raw = JSON.parse(fact.body.snapshot);
    const snapshot = take(decodeHarnessAdapterStateSnapshot(raw, author.decodeContext));
    const canonicalHash = harnessAdapterIdentity(snapshot).canonicalHash;
    if (fact.body.canonicalHash !== canonicalHash) {
      throw new Error('Part Two harness state canonical identity mismatch');
    }
    return { fact, snapshot, canonicalHash };
  };

  const append = (expected, snapshot) => {
    const before = current();
    if (before.canonicalHash !== expected) {
      throw new Error('harness adapter state compare-and-swap mismatch');
    }
    const decoded = take(decodeHarnessAdapterStateSnapshot(snapshot, author.decodeContext));
    const identity = harnessAdapterIdentity(decoded).canonicalHash;
    const head = before.fact;
    const segment = {
      machine: author.machine,
      epoch: head?.segment.epoch ?? 0,
      position: head ? head.segment.position + 1 : 0,
    };
    const envelope = signEnvelope({
      type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind: STATE_KIND,
      schemaVersion: 1, at: author.clock, machine: author.machine,
      principal: json(author.principal), provenance: json(author.provenance), segment,
      prevInSegment: head?.contentHash ?? author.context.genesis.hash,
      predecessors: {
        inSegment: head?.id ?? null, frontier: author.context.folded, required: [],
      },
      body: { stateId, canonicalHash: identity, snapshot: encoded(decoded).bytes },
    }, author.privateKey);
    take(store.append(envelope));
  };

  return Object.freeze({
    owner: 'part-thirteen',
    id: stateId,
    load() {
      let found = current();
      if (!found.snapshot) {
        const legacy = legacySnapshot(path);
        if (legacy !== null) {
          const migrated = take(decodeHarnessAdapterStateSnapshot(legacy, author.decodeContext));
          append(null, migrated);
          found = current();
        }
      }
      return found.snapshot;
    },
    save(expected, snapshot) {
      append(expected, snapshot);
    },
  });
}

export function harnessAdapterFactDirectory(path) {
  return `${path}.part-two`;
}
