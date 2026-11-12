// Rules 28/89/100/113/123: host custody, signed peer scope, private-by-default delivery.
// Carries 1.x db3ed6d3 ThreadlineBootstrap's persistent identity and always-on bootstrap.
// Local encrypted spool replaces its HTTP relay for this slice: no new listener or service.
import { createHash, createHmac, createPublicKey, randomBytes, verify } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { consumeResult } from '../src/index.js';
import { sealEnvelope } from '../src/rungraph/index.js';
import { createThreadlineKeyCustody, createThreadlineReferenceAdapter, threadlineIdentityFromSeeds } from '../src/transport/index.js';
import { readSetupRecord, publishSetupRecord } from './onboarding-state.mjs';
const hash = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const take = result => consumeResult(result, { Success: value => value, Refused: () => { throw Error('Threadline transport refused'); } });
const refused = reason => ({ status: 'refused', reason });
export const THREADLINE_LOSS_MODEL = 'Permanent loss of this machine may destroy the complete cause and evidence of a send; an unknown earlier send must never be repeated.';
const token = value => typeof value === 'string' && /^[A-Za-z0-9:._-]{1,180}$/u.test(value);
export const THREADLINE_TOOLS = ['threadline_send', 'threadline_receive', 'threadline_status'];
export function threadlineRequest(tool, input) {
  return THREADLINE_TOOLS.includes(tool) && input && Object.getPrototypeOf(input) === Object.prototype
    && token(input.peer) && token(input.request)
    && Object.keys(input).sort().join(',') === (tool === 'threadline_send' ? 'message,peer,request' : 'peer,request')
    && (tool !== 'threadline_send' || typeof input.message === 'string' && input.message.trim().length > 0 && Buffer.byteLength(input.message) <= 8192);
}
/** The installer pins the owner's public key; the worker never receives this root.
 * A peer signature authenticates a peer, never the owner or a human approval. */
export function readThreadlineScope(root, principal, topic, now) {
  const owner = readSetupRecord(join(root, 'threadline-owner.json'));
  const signed = readSetupRecord(join(root, 'threadline-team.json'));
  if (!owner || !signed || !verify(null, Buffer.from(JSON.stringify(signed.record)), createPublicKey(owner.publicKey), Buffer.from(signed.signature, 'base64')))
    throw Error('owner-signed team record required (Rule 123)');
  const record = signed.record;
  if (record.version !== 1 || record.principal !== principal || record.owner !== owner.id || record.withdrawn !== false
    || record.durability?.demand !== 'local-durable' || record.durability?.causalPrefix !== 'full' || record.durability?.lossModel !== THREADLINE_LOSS_MODEL
    || !Number.isSafeInteger(record.expiresAt) || record.expiresAt <= now || !Array.isArray(record.peers) || record.peers.length > 32)
    throw Error('current owner-signed team record required (Rule 123)');
  // Each topic is an explicit private share. No wildcard, inherited team membership or peer-supplied scope.
  return record.peers.filter(peer => peer.topic === topic && token(peer.principal) && token(peer.conversation)
    && typeof peer.inbox === 'string' && isAbsolute(peer.inbox));
}
/** Exact installation acceptance, separate from role: never add generic MCP to P-08.
 * The full signed acceptance and existing policy travel in the durable effect cause. */
export function admitThreadline(runtime, tool, input, parent, config, decide, now) {
  if (!tool.startsWith('mcp__threadline__')) return null;
  try {
    if (!threadlineRequest(tool.slice(17), input)) throw Error('request-scope');
    const acceptance = runtime.scope(input, parent);
    const registration = config.effectPolicy.registered.find(row => row.effect === 'tool:mcp' && row.target === tool);
    if (!registration || registration.costUsd !== 0 || registration.reversibility !== (tool.endsWith('_send') ? 'irreversible' : 'reversible'))
      throw Error('exact zero-cost Threadline operation registration required');
    const verdict = decide(tool, input, { ...config, operations: [...config.operations, 'tool:mcp'] }, now);
    return { ...verdict, localCause: JSON.stringify({ acceptance, parent, tool, input, configuration: config, decision: verdict }) };
  } catch { return { admitted: false, disposition: 'refused', reason: 'Threadline needs a current owner-signed private share and exact durable operation registration (Rules 28/123; purpose durable cause)' }; }
}
export function createThreadlineRuntime({ root, custody, storageKey, now, stopped, held, append, recorded, records, replicate = async () => true, replicated = false }) {
  const directory = join(root, 'threadline'), inbox = join(directory, 'inbox');
  mkdirSync(inbox, { recursive: true, mode: 0o700 });
  const identityPath = join(directory, 'identity.json');
  let saved = readSetupRecord(identityPath);
  if (!saved) {
    const seeds = createHmac('sha512', storageKey).update('instar2/threadline/identity/v1').digest('base64');
    const ref = custody.store({ value: seeds, kind: 'threadline', source: 'Threadline bootstrap' });
    saved = publishSetupRecord(identityPath, { ref });
  }
  const seeds = Buffer.from(custody.resolve(saved.ref), 'base64');
  if (seeds.length !== 64) throw Error('Threadline identity custody unavailable');
  const identity = threadlineIdentityFromSeeds(seeds.subarray(0, 32), seeds.subarray(32));
  const publicKeys = Object.fromEntries(Object.entries(identity.public).map(([name, key]) => [name, key.export({ format: 'pem', type: 'spki' }).toString()]));
  const principal = hash(publicKeys);
  const publicRecord = { principal, ...publicKeys, inbox: realpathSync(inbox) };
  if (JSON.stringify(publishSetupRecord(join(directory, 'public.json'), publicRecord)) !== JSON.stringify(publicRecord))
    throw Error('Threadline public identity differs from custody');
  const context = { site: 'threadline.host', preserved: 'threadline:encrypted-spool', captures: {}, register: {
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'threadline:host' }, entries: ['threadline.host'], producers: ['host'],
    methods: [], actions: {}, subjects: {}, sites: { 'threadline.host': 'closed', 'types.decode': 'closed' }, keys: {},
    allowRedelegation: false, conflictStanding: { ordinary: 'delegate', authority: 'operator' } } };
  const live = () => !stopped();
  const savedRecords = () => records().filter(row => row.operation.startsWith('threadline:'));
  const remember = (key, operation, data, parent) => {
    const id = hash([principal, operation, key]);
    if (!recorded(id)) append({ type: 'SessionWorkEffect', schemaVersion: 1, id, edge: parent.id, operation, digest: hash(data),
      state: 'prepared', detail: 'durable Threadline data; no human authority', cause: JSON.stringify(data), at: now(), topic: parent.topic });
    return id;
  };
  const mark = (key, state, envelope, topic) => {
    const id = hash([principal, key, state]);
    if (!recorded(id)) append({ type: 'SessionWorkEffect', schemaVersion: 1, id, edge: envelope.edge,
      operation: 'threadline:receive', digest: envelope.digest, state: 'prepared', detail: state, cause: JSON.stringify({ envelope, principal, topic }), at: now(), topic });
    return id;
  };
  return { publicRecord,
    scope(input, parent) {
      const peers = readThreadlineScope(root, principal, parent.topic, now());
      if (!peers.some(peer => peer.principal === input.peer)) throw Error('unknown-peer-or-private-scope');
      return readSetupRecord(join(root, 'threadline-team.json'));
    },
    async exchange(tool, input, parent, stillAuthorized = () => true) {
      if (!live()) return refused('stop-or-ownership');
      if (!threadlineRequest(tool, input)) return refused('request-scope');
      if (savedRecords().length >= 4096) return refused('capacity-full; accepted-intake-retained');
      let peers;
      try { peers = readThreadlineScope(root, principal, parent.topic, now()); } catch { return refused('owner-signed-private-share-required'); }
      const peer = peers.find(p => p.principal === input.peer);
      if (!peer) return refused('unknown-peer-or-private-scope');
      if (held(JSON.stringify(input)) !== 'clear') return refused('secret-check');
      const authorized = () => live() && stillAuthorized() && JSON.stringify(readThreadlineScope(root, principal, parent.topic, now())) === JSON.stringify(peers);
      const keyCustody = createThreadlineKeyCustody({ principal, identity, random: randomBytes,
        peer: name => {
          const row = peers.find(p => p.principal === name);
          return row ? { signing: createPublicKey(row.signing), agreement: createPublicKey(row.agreement) } : undefined;
        } });
      let collected = [], received = [];
      const pending = [];
      const history = savedRecords();
      const durable = (operation, key) => history.find(row => row.id === hash([principal, operation, key]));
      const readKey = [peer.principal, parent.topic, input.request];
      const previousReadRow = durable('threadline:read', readKey);
      const previousRead = previousReadRow ? JSON.parse(previousReadRow.cause) : null;
      const acknowledged = new Set(history.filter(row => row.operation === 'threadline:read').flatMap(row => JSON.parse(row.cause).keys));
      const flush = async () => {
        if (!await replicate() || !authorized()) throw Error('durability-or-owner-unavailable');
        for (const frame of pending.splice(0)) {
          const target = peers.find(p => p.principal === frame.recipient);
          if (!target || realpathSync(target.inbox) !== target.inbox) throw Error('route unavailable');
          const path = join(target.inbox, `${hash([frame.sender, frame.key, frame.kind]).slice(7)}.json`);
          if (!existsSync(path) && readdirSync(target.inbox).length >= 1024) throw Error('inbox capacity');
          const stored = publishSetupRecord(path, frame);
          if (stored.digest !== frame.digest) throw Error('message identity conflict');
        }
      };
      const relay = {
        submit(frame) {
          if (!authorized()) return 'rejected';
          pending.push(frame); return 'accepted';
        },
        collect() {
          const names = readdirSync(inbox);
          if (names.length > 1024) throw Error('Threadline inbox bound exceeded');
          collected = names.filter(name => /^[a-f0-9]{64}\.json$/u.test(name)).map(name => readSetupRecord(join(inbox, name)))
            .filter(frame => frame?.sender === peer.principal && frame.conversation === peer.conversation);
          return collected;
        },
      };
      const adapter = createThreadlineReferenceAdapter({ keys: keyCustody, relay, now, freshFor: 60000, context, advertisements: () => [] });
      const endpoint = {
        lookup(key, digest, from) {
          const row = history.find(row => row.operation === 'threadline:receive' && row.cause
            && JSON.parse(row.cause).envelope.key === key && JSON.parse(row.cause).envelope.digest === digest
            && JSON.parse(row.cause).envelope.sender === from);
          return row ? { key, digest, state: 'durably-queued', authoritative: row.id, result: null, durability: replicated ? 'replicated' : 'local-durable' }
            : { key, digest, state: 'unknown', authoritative: 'none', result: null, durability: null };
        },
        receive(envelope, at, from) {
          const deny = () => ({ key: envelope.key, digest: envelope.digest, state: 'refused', refusedWhat: 'receiving-admission', authoritative: 'private-scope', result: null, durability: null });
          if (!authorized() || from !== peer.principal || envelope.conversation !== peer.conversation || envelope.kind !== 'progress'
            || envelope.grants.length || envelope.contract || envelope.result || envelope.scope.length !== 1 || envelope.scope[0] !== peer.conversation
            || typeof envelope.reason !== 'string' || Buffer.byteLength(envelope.reason) > 8192 || held(envelope.reason) !== 'clear') return deny();
          // Keep the verified payload in the encrypted journal before its receipt; peer words never become authority.
          const id = mark(envelope.key, 'durably-queued peer data; not an instruction or approval', envelope, parent.topic);
          const receipt = { key: envelope.key, digest: envelope.digest, state: 'durably-queued', authoritative: id, result: null, durability: replicated ? 'replicated' : 'local-durable' };
          if (previousRead ? previousRead.keys.includes(envelope.key) : !acknowledged.has(envelope.key))
            received.push({ from, key: envelope.key, message: envelope.reason, authority: 'peer-data-only' });
          return receipt;
        },
      };
      if (tool === 'threadline_status') {
        const priorRow = durable('threadline:send', `${principal}|${input.request}`);
        const prior = priorRow ? JSON.parse(priorRow.cause) : null;
        if (!prior) return refused('unknown-request');
        const original = prior.envelope;
        if (original.recipient !== peer.principal || original.conversation !== peer.conversation) return refused('private-scope');
        take(adapter.port.observe(original, `${input.request}:lookup`));
        adapter.pump(endpoint);
        const receipt = take(adapter.port.observe(original, `${input.request}:lookup`));
        await flush();
        return { status: receipt.state, receipt };
      }
      if (tool === 'threadline_receive') {
        // Rebuild private intake from the shared encrypted journal after a host replacement.
        for (const row of history.filter(row => row.operation === 'threadline:receive')) {
          const envelope = JSON.parse(row.cause).envelope;
          if (envelope.sender === peer.principal && envelope.conversation === peer.conversation) endpoint.receive(envelope, now(), envelope.sender);
        }
        const rejected = adapter.pump(endpoint);
        received = [...new Map(received.map(message => [message.key, message])).values()];
        if (!authorized()) return refused('withdrawn');
        received = received.slice(0, 8);
        if (previousRead && previousRead.keys.some(key => !received.some(message => message.key === key))) return refused('durable-intake-missing');
        remember(readKey, 'threadline:read', { keys: received.map(message => message.key) }, parent);
        await flush();
        return { status: 'received', messages: received, rejected: rejected.length };
      }
      const key = `${principal}|${input.request}`;
      const priorRow = durable('threadline:send', key);
      const prior = priorRow ? JSON.parse(priorRow.cause) : null;
      const content = hash([peer.principal, peer.conversation, input.message]);
      if (prior) {
        if (prior.content !== content) return refused('request-identity-conflict');
        const original = prior.envelope;
        take(adapter.port.observe(original, `${input.request}:lookup`));
        adapter.pump(endpoint);
        const receipt = take(adapter.port.observe(original, `${input.request}:lookup`));
        await flush();
        return { status: 'already-prepared', key, outcome: receipt.state === 'durably-queued' ? receipt.state : prior.outcome,
          receipt: receipt.state === 'durably-queued' ? receipt : null };
      }
      const envelope = sealEnvelope({ kind: 'progress', key, sender: principal, recipient: peer.principal, edge: parent.id,
        parentRun: parent.parent ?? parent.id, childRun: parent.child, conversation: peer.conversation, contractDigest: content,
        scope: [peer.conversation], grants: [], resultDestination: { run: parent.child, edge: null }, answers: null,
        contract: null, result: null, reason: input.message, at: now() });
      // Irreversible send preparation precedes dispatch; an interrupted outcome is never re-sent.
      remember(key, 'threadline:send', { content, envelope, outcome: 'uncertain' }, parent);
      const evidence = take(adapter.port.send(envelope, input.request, 'submit'));
      adapter.pump(endpoint);
      const receipt = take(adapter.port.observe(envelope, `${input.request}:receipt`));
      const outcome = receipt.state === 'durably-queued' ? receipt.state : evidence.state;
      await flush();
      return { status: outcome, key, receipt: receipt.state === 'durably-queued' ? receipt : null };
    },
  };
}
