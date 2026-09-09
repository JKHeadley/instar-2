import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonical, decode, decodeMeasurement } from '../../src/index.js';
import type { Clock, Json, ProvenanceInput, Scope } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { CausalFrontier, FactEnvelope, FactSchema } from '../../src/facts/index.js';
import { createIntakePort, scheduledIntakeFactSchemas } from '../../src/intake/index.js';
import type { InboundRoute, IntakeDependencies } from '../../src/intake/index.js';
import { intakeFixture, json, value } from './fixtures.js';

const peerPrivateKey = createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + '22'.repeat(32), 'hex'),
  format: 'der', type: 'pkcs8' }).export({ format: 'pem', type: 'pkcs8' }).toString();

export const scheduledAdapterId = 'scheduled-ingress';
export const scheduledPrincipalId = 'package:scheduler';

export function scheduledFixture(options: { directory?: string; machine?: 'machine-a'|'machine-b' } = {}) {
  const base = intakeFixture(options), machine = options.machine ?? 'machine-a';
  Object.assign(base.context, { schemas: [...base.context.schemas, ...scheduledIntakeFactSchemas(base.f.scope)] });
  const declarations = JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8')) as object[];
  const parser = base.r.declaration(scheduledAdapterId, 'parsers', {
    fixture: 'check', authenticationClass: [{ stimulusType: 'scheduled-tick', class: 'verified' }],
    eventIdAuthority: { mintedBy: 'intake', uniquenessScope: 'installation-job-instant', replayWindow: 0,
      fallbackFingerprint: { policy: 'none', basis: 'canonical namespace/job/instant identity required' } },
    ackPolicy: 'never',
  }, { profile: base.r.profile });
  const governance = base.govern([...declarations, parser]).governance;
  const priorRegister = base.context.decode.register;
  const key = priorRegister.keys.host!;
  const register = { ...priorRegister,
    entries: [...new Set([...priorRegister.entries, scheduledAdapterId, 'scheduled-clock'])],
    keys: { ...priorRegister.keys, host: { ...key, adapters: [...new Set([...key.adapters, scheduledAdapterId])] } },
  };
  Object.assign(base.f.ctx, { register });
  Object.assign(base.context, { decode: { ...base.context.decode, register } });
  const proof = base.f.proof({ id: scheduledPrincipalId, kind: 'system' },
    { id: scheduledPrincipalId, kind: 'system' }, 'package-system-principal');
  const provenanceInput = { ...proof.input, adapter: scheduledAdapterId } as ProvenanceInput;
  base.syncCaptures();
  const provenance = value(decode('Provenance', provenanceInput, base.context.decode));
  const principal = value(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1,
    id: scheduledPrincipalId, kind: 'system' }, { ...base.context.decode, provenance }));
  base.f.principals.push(principal);
  Object.assign(base.context, { decode: { ...base.context.decode,
    principals: [...base.context.decode.principals ?? [], principal] } });

  let instant = 100;
  const clock = (at: number, source = 'scheduled-clock'): Clock => value(decodeMeasurement('clock', base.f.clockRaw(at, source), base.context.decode));
  const adapter = {
    id: scheduledAdapterId,
    authenticate(_raw: string, route: InboundRoute) {
      return base.f.success({ provenance: provenanceInput, principalId: principal.id, principalKind: 'system' as const,
        channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch });
    },
    parse(raw: string) { return JSON.parse(raw) as Json; },
  };
  const latest = () => {
    const lineages: Record<string, { head: { epoch: number; position: number }; observedAt: number; closed: false }> = {};
    for (const row of base.frames as FactEnvelope[]) {
      const current = lineages[row.machine];
      if (!current || row.segment.epoch > current.head.epoch
        || row.segment.epoch === current.head.epoch && row.segment.position > current.head.position)
        lineages[row.machine] = { head: { epoch: row.segment.epoch, position: row.segment.position }, observedAt: instant, closed: false };
    }
    return lineages;
  };
  const depsForMachine = (sourceMachine: 'machine-a'|'machine-b'): IntakeDependencies => ({ ...base.deps, adapter, governance,
    author: { machine: sourceMachine, principal, provenance,
      privateKey: sourceMachine === 'machine-a' ? base.deps.author.privateKey : peerPrivateKey },
    clock: () => clock(instant, sourceMachine), dedupGeneration: () => ({ reference: base.context.decode.register.generation,
      kinds: [...new Set(base.context.schemas.map(schema => schema.kind))], lineages: latest() }),
  });
  const deps: IntakeDependencies = depsForMachine(machine);
  const port = () => value(createIntakePort(deps));
  const portForMachine = (sourceMachine: 'machine-a'|'machine-b') => value(createIntakePort(depsForMachine(sourceMachine)));
  const route = (installation = 'installation-a'): InboundRoute => ({ adapter: scheduledAdapterId,
    channel: `scheduled:${installation}`, sender: principal.id, identityEpoch: provenance.record.hash, eventId: null });
  const tick = (overrides: Partial<{ schemaVersion: number; jobInstance: string; scheduledInstant: Clock;
    packageDigest: `sha256:${string}`; calendarPolicyVersion: string; timeZoneDataVersion: string }> = {}) => {
    const body = { schemaVersion: 1, jobInstance: 'job:nightly', scheduledInstant: clock(1000),
      packageDigest: value(canonical('package:v1')).hash, calendarPolicyVersion: 'cron-v1', timeZoneDataVersion: 'tzdb:2026a', ...overrides };
    const eventId = value(canonical([body.schemaVersion, body.jobInstance, new Date(body.scheduledInstant.value).toISOString()])).hash;
    return { body, raw: value(canonical(body)).bytes, eventId, route: { ...route(), eventId } as InboundRoute };
  };
  const grantSchema: FactSchema = { ...base.f.schema, kind: 'scheduled-system-grant',
    fields: { grant: { kind: 'constitutional', type: 'StandingGrant' } } };
  const evidenceSchema: FactSchema = { ...base.f.schema, kind: 'scheduled-discovery-evidence',
    fields: { evidence: { kind: 'constitutional', type: 'Evidence' } } };
  function installSchemas() {
    const additions = [grantSchema, evidenceSchema].filter(schema => !base.context.schemas.some(row => row.kind === schema.kind));
    if (additions.length) Object.assign(base.context, { schemas: [...base.context.schemas, ...additions] });
  }
  function append(kind: string, body: Json, at: Clock, sourceMachine: 'machine-a'|'machine-b', required: readonly string[] = [],
    actor = principal, source = provenance) {
    installSchemas();
    const factContext = { ...base.context, decode: { ...base.context.decode, provenance: source } };
    return value(authorAndAppend({ kind, schemaVersion: 1, machine: sourceMachine, principal: json(actor), provenance: json(source),
      at: json(at), body, required }, factContext, createFactStore(factContext, base.storage),
    sourceMachine === 'machine-a' ? base.deps.author.privateKey : peerPrivateKey)).fact;
  }
  function grant(scope: Scope = base.f.scope) {
    installSchemas();
    const valueGrant = base.f.grant({ id: 'scheduled-grant:1', grantee: principal, standing: 'delegate', actions: ['work'], scope });
    base.syncCaptures();
    const fact = append('scheduled-system-grant', json({ grant: valueGrant }), base.f.now, 'machine-a', [], base.f.alice, valueGrant.source);
    Object.assign(base.context, { grants: [...base.context.grants, { factId: fact.id, grant: valueGrant }] });
    return { fact, grant: valueGrant };
  }
  function discovery(eventId: string, sourceMachine: 'machine-a'|'machine-b' = machine, observedAt = instant) {
    installSchemas();
    const bytes = `discovered:${sourceMachine}:${eventId}:${observedAt}`;
    const reference = `scheduled-discovery:${sourceMachine}:${observedAt}:${eventId}`;
    const hash = base.f.capture(bytes, reference); base.syncCaptures();
    const at = clock(observedAt, sourceMachine);
    const evidence = value(decode('Evidence', { type: 'Evidence', schemaVersion: 1, id: `evidence:${sourceMachine}:${observedAt}:${eventId}`,
      claim: { subject: eventId, predicate: 'scheduled-discovery', value: true }, source: sourceMachine, observedAt: at,
      freshFor: 1000, capture: { reference, hash }, strength: 'observation' }, base.context.decode));
    base.f.evidence.push(evidence);
    Object.assign(base.context, { decode: { ...base.context.decode, evidence: [...base.context.decode.evidence ?? [], evidence] } });
    return { fact: append('scheduled-discovery-evidence', json({ evidence }), at, sourceMachine), evidence };
  }
  function frontier(): CausalFrontier {
    return Object.fromEntries(Object.entries(latest()).map(([id, value]) => [id, value.head]));
  }
  function bind(overrides: Record<string, Json> = {}) {
    const retained = [...base.context.grants], binding = base.bind(overrides);
    Object.assign(base.context, { grants: [...base.context.grants,
      ...retained.filter(candidate => !base.context.grants.some(current => current.factId === candidate.factId))] });
    return binding;
  }
  return { ...base, bind, deps, depsForMachine, port, portForMachine, principal, provenance, provenanceInput, route, tick, grant, discovery, frontier,
    grantSchema, evidenceSchema, installSchemas, clock, setTime: (at: number) => { instant = at; } };
}
