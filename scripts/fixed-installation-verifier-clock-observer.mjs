// Operator host, never loaded in the Native worker. No signing key is held here:
// One verifies a proof made by the independently provisioned operator factor.
import { randomBytes, createHash } from 'node:crypto';
import { openSync, closeSync, writeFileSync, readFileSync, fsyncSync, lstatSync,
  realpathSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function createFixedInstallationHost(input) {
  const { one, nine } = input.owners; // Actual public owner modules, composed by the trusted host.
  const take = result => one.consumeResult(result, { Success: value => value, Refused: refusal => { throw Error(refusal.detail); } });
  const canonical = value => take(one.canonical(value));
  const check = (condition, detail) => { if (!condition) throw Error(detail); };
  const result = (name, run) => {
    const decoder = take(one.defineDecoder({ name, owner: 'part-nine', currentVersion: 1,
      versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
      decodeCurrent: () => { try { return { ok: true, value: run() }; }
        catch (error) { return { ok: false, detail: error.message }; } },
    }, input.boundary.preserved));
    return one.deriveThrough(decoder, { type: name, schemaVersion: 1 }, input.boundary);
  };
  const config = Object.freeze(structuredClone(input.configuration));
  check(config.subject !== config.observer && config.subject && config.observer
    && config.domain && config.trustReference && config.service && config.surface
    && config.commonFailures?.length > 0, 'independent host configuration incomplete');
  check(Number.isSafeInteger(config.operatorUid) && config.operatorUid === process.getuid()
    && Number.isSafeInteger(config.agentUid) && config.agentUid !== config.operatorUid,
  'verifier must run outside the agent OS identity');
  check(config.factorKey && Number.isSafeInteger(config.maxChallenges) && config.maxChallenges > 0
    && Number.isSafeInteger(config.maxLifetime) && config.maxLifetime > 0,
  'independently installed factor and finite challenge bounds required');
  const directory = resolve(config.journal);
  const stat = lstatSync(directory);
  check(realpathSync(directory) === directory && stat.isDirectory() && !stat.isSymbolicLink()
    && stat.uid === config.operatorUid && (stat.mode & 0o077) === 0,
  'verifier journal must be operator-owned private storage');
  const sync = () => { const fd = openSync(directory, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
  const nameFor = id => createHash('sha256').update(id).digest('hex');
  const writeOnce = (name, bytes) => {
    const fd = openSync(join(directory, name), 'wx', 0o600);
    try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    sync();
  };
  const read = name => {
    const path = join(directory, name), s = lstatSync(path);
    check(s.isFile() && !s.isSymbolicLink() && s.uid === config.operatorUid && (s.mode & 0o077) === 0,
      'verifier journal entry ownership changed');
    return JSON.parse(readFileSync(path, 'utf8'));
  };
  let previous = -1;
  const now = () => {
    const value = Date.now();
    check(value >= previous, 'verification clock moved backwards'); previous = value;
    return take(one.decodeMeasurement('clock', { type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'clock', instance: config.clockSubject }, value, unit: 'unix-ms', at: value,
      by: config.clockProducer }, input.context()));
  };
  const binding = () => {
    const c = input.context(), key = c.register.keys[config.factorKey];
    check(key?.algorithm === 'ed25519' && key.publicKey
      && key.adapters.includes(config.surface), 'independent verifier factor unavailable');
    check(c.principals?.some(p => p.id === config.operator && p.kind === 'person'
      && p.provenance.class === 'verified'), 'independent operator identity unavailable');
    return c;
  };
  const verifier = Object.freeze({ owner: 'part-nine', administration: 'independent',
    issue: subject => result('FixedInstallationChallengeIssue', () => {
      const c = binding(), at = now();
      check(subject && Object.keys(subject).sort().join(',') ===
        'action,artifact,audience,base,expiresAt,generation,issuedAt,operator,renderingDigest,request,requestDigest,requestedBy,scope,singleUse,surface',
      'closed challenge subject required');
      check(subject.singleUse === true && subject.surface === config.surface && subject.operator === config.operator
        && Number.isSafeInteger(subject.issuedAt) && Number.isSafeInteger(subject.expiresAt)
        && subject.requestedBy !== config.operator && subject.issuedAt <= at.value
        && subject.expiresAt > at.value && subject.expiresAt - subject.issuedAt <= config.maxLifetime
        && canonical(subject.generation).bytes === canonical(c.register.generation).bytes,
      'challenge identity, generation or expiry differs');
      take(one.decode('Scope', subject.scope, c));
      for (const field of ['artifact', 'requestDigest', 'renderingDigest']) check(/^sha256:[a-f0-9]{64}$/.test(subject[field]), 'challenge digest missing');
      for (const field of ['request', 'action', 'audience', 'base', 'requestedBy']) check(typeof subject[field] === 'string'
        && subject[field].length > 0 && subject[field].length <= 512, 'bounded challenge field required');
      check(readdirSync(directory).filter(name => name.endsWith('.challenge')).length < config.maxChallenges,
        'verifier challenge capacity exhausted');
      const challenge = Object.freeze({ ...structuredClone(subject), id: `challenge:${randomBytes(32).toString('hex')}` });
      writeOnce(`${nameFor(challenge.id)}.challenge`, canonical(challenge).bytes);
      return challenge;
    }),
    verify: (challenge, proof, decision) => result('FixedInstallationChallengeVerify', () => {
      const c = binding(), at = now(), name = nameFor(challenge.id);
      check(canonical(read(`${name}.challenge`)).bytes === canonical(challenge).bytes, 'challenge bytes changed');
      check(decision === 'approve' || decision === 'decline', 'challenge decision invalid');
      check(challenge.issuedAt <= at.value && at.value < challenge.expiresAt
        && canonical(challenge.generation).bytes === canonical(c.register.generation).bytes, 'challenge expired or generation changed');
      check(typeof proof === 'string' && Buffer.byteLength(proof) <= 65536, 'bounded challenge proof required');
      const supplied = JSON.parse(proof);
      check(supplied.type === 'VerifiedActProofBundle' && supplied.schemaVersion === 1
        && supplied.challenge?.evidence?.keyId === config.factorKey
        && supplied.challenge?.evidence?.kind === 'signature', 'proof requires independently installed factor');
      const provenance = take(one.decode('Provenance', supplied.challenge, c));
      check(provenance.class === 'verified' && provenance.adapter === config.surface
        && provenance.authenticated.principal.id === config.operator
        && provenance.authenticated.principal.kind === 'person'
        && provenance.authenticated.recordType === 'verified-operator-challenge', 'independent operator proof required');
      let act = null;
      if (supplied.act !== null) {
        const source = take(one.decode('Provenance', supplied.act, c));
        check(source.class === 'verified' && source.adapter === config.surface
          && source.authenticated.principal.id === config.operator
          && source.authenticated.recordType === 'approval', 'only the operator approval act is supported by this host');
        act = take(one.decode('Authorization', { type: 'Authorization', schemaVersion: 1,
          ...source.authenticated.payload, explicitYes: source }, { ...c, provenance: source }));
      }
      check(decision !== 'decline' || act === null, 'decline cannot carry authority');
      check(decision !== 'approve' || challenge.audience === 'independent-emergency-stop' || act !== null,
        'approval requires its exact authorization act');
      const expected = { type: 'VerifiedOperatorChallenge', schemaVersion: 1, challenge: challenge.id,
        ...Object.fromEntries(Object.entries(challenge).filter(([key]) => key !== 'id')),
        decision, actDigest: act === null ? 'none' : canonical(act).hash };
      check(canonical(provenance.authenticated.payload).bytes === canonical(expected).bytes,
        'proof differs from exact challenge, rendering, artifact, base, scope or decision');
      // Persist the one-use claim BEFORE returning any consequential proof.
      // A lost return or restart never reopens the challenge.
      try { writeOnce(`${name}.used`, canonical({ challenge: challenge.id, proof: canonical(proof).hash }).bytes); }
      catch { throw Error('challenge already consumed or durable replay journal unavailable'); }
      const capture = take(input.capture.preserve(proof, at));
      return Object.freeze({ challenge: challenge.id, principal: c.principals.find(p => p.id === config.operator),
        provenance, act, capture });
    }),
  });
  return Object.freeze({ verifier, clock: () => result('FixedInstallationClock', now),
    identities: Object.freeze({ domain: config.domain, trustReference: config.trustReference, service: config.service,
      subject: config.subject, observer: config.observer, commonFailures: Object.freeze(config.commonFailures) }),
    freshness: evidence => result('FixedInstallationEvidenceConsumption', () =>
      take(nine.verificationEvidenceFreshness(evidence, now(), input.boundary))),
    // An occurrence assessment alone says nothing about destination acceptance.
    // Keep the observer closed until an authentic exact-post witness is installed.
    observePost: () => result('FixedInstallationPostObservation', () => {
      throw Error('platform-delivery-witness: authentic exact-post evidence unavailable');
    }),
    readiness: () => result('FixedInstallationVerifierReadiness', () => {
      binding();
      const state = input.probes?.();
      check(state && state.probes.length > 0, 'live verifier probes unavailable');
      const at = now();
      check(state.plan.independence.testedPrincipal === config.subject
        && state.plan.independence.observerPrincipal === config.observer
        && state.plan.independence.witnessController !== config.subject, 'probe independence differs');
      check(state.plan.subject.governed === config.service
        && state.plan.subject.generation === input.context().register.generation.id, 'probe subject or generation differs');
      for (const arm of ['issue', 'verify', 'replay', 'expiry']) check(state.plan.arms.some(row => row.id === arm && row.required)
        && state.probes.some(probe => probe.arm === arm && probe.plan === state.plan.id && probe.planVersion === state.plan.bar.version
        && probe.disposition === 'passed' && nine.probeBoundToCurrentEvidence(state.plan, probe, at,
          state.evidence, input.context(), state.facts, input.boundary)), `live verifier probe missing: ${arm}`);
      return Object.freeze({ service: config.service, observedAt: at, probes: state.probes.map(p => p.id) });
    }),
  });
}

// The operator supplies an independently administered composition module. It
// supplies public owner contexts/ports and no private key to this script.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = process.argv[2];
  if (!file) throw Error('operator-owned configuration module required');
  const configPath = realpathSync(file), s = lstatSync(configPath);
  if (s.uid !== process.getuid() || (s.mode & 0o022) !== 0) throw Error('operator configuration ownership invalid');
  const one = await import('../dist/index.js'), nine = await import('../dist/verification/index.js');
  const configuration = await import(pathToFileURL(configPath).href);
  await configuration.serve(createFixedInstallationHost(await configuration.compose({ one, nine })));
}
