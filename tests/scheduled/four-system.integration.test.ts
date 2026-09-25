import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { consumeResult, isValid } from '../../src/index.js';
import type { Authorization, ProvenanceInput } from '../../src/index.js';
import { authorAndAppend, causalCone, createFactStore } from '../../src/facts/index.js';
import type { FactSchema } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { createScheduledIntakeAdapter, createScheduledWorkPackagePort, decodeScheduledWorkManifest } from '../../src/scheduled/index.js';
import { intakeFixture, json, message, value } from '../intake/fixtures.js';
import { clone, scheduledFixture } from './fixture.js';

describe('Four scheduled system exception', () => {
  it('admits verified system input only on the registered scheduled parser', () => {
    const f = intakeFixture();
    const scheduled = f.r.declaration('scheduled-intake-v1', 'parsers', {
      fixture: 'check', authenticationClass: [{ stimulusType: 'message', class: 'verified' }],
      eventIdAuthority: { mintedBy: 'registered scheduled package', uniquenessScope: 'job instance',
        replayWindow: 0, fallbackFingerprint: { policy: 'none', basis: 'occurrence hash' } }, ackPolicy: 'never',
    }, { profile: f.r.profile });
    const declarations = JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8')) as object[];
    const governance = f.govern([...declarations, scheduled]).governance;
    const system = f.f.proof({ id: 'principal:scheduler', kind: 'system' },
      { id: 'principal:scheduler', kind: 'system' }, 'identity');
    f.syncCaptures();
    const register = f.context.decode.register;
    const host = register.keys.host!;
    Object.assign(f.context, { decode: { ...f.context.decode, register: {
      ...register, entries: [...register.entries, 'scheduled-intake-v1'],
      keys: { ...register.keys, host: { ...host, adapters: [...host.adapters, 'scheduled-intake-v1'] } },
    } } });
    const route = { channel: 'scheduled:instance', sender: 'principal:scheduler',
      identityEpoch: 'key:1', eventId: 'sha256:' + 'a'.repeat(64) };
    let principalKind: 'system' | 'agent' = 'system';
    const adapter = { id: 'scheduled-intake-v1', authenticate: () => f.f.success({
      provenance: { ...system.input, adapter: 'scheduled-intake-v1' } as ProvenanceInput,
      principalId: 'principal:scheduler', principalKind,
      channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch,
    }), parse: () => ({ schemaVersion: 1, kind: 'message', text: 'inspect' }) };
    const port = consumeResult(createIntakePort({ ...f.deps, adapter, governance }), {
      Success: item => item, Refused: row => { throw Error(row.detail); } });
    const received = consumeResult(port.receive(message('inspect'), route), {
      Success: item => item, Refused: row => { throw Error(row.detail); } });
    expect(received.kind).toBe('admitted');
    if (received.kind === 'admitted') expect(received.intent.principal.kind).toBe('system');
    const duplicate = consumeResult(port.receive(message('inspect'), route), {
      Success: item => item, Refused: row => { throw Error(row.detail); } });
    expect(duplicate.kind).toBe('duplicate');
    principalKind = 'agent';
    const refused = consumeResult(port.receive(message('inspect'), { ...route, eventId: 'sha256:' + 'b'.repeat(64) }), {
      Success: () => '', Refused: row => row.detail });
    expect(refused).toContain('preserved hold');
  });

  it('retains the exact checked manifest and approval facts after source replacement and reconstruction', () => {
    const f = intakeFixture(), s = scheduledFixture();
    const scheduled = f.r.declaration('scheduled-intake-v1', 'parsers', {
      fixture: 'check', authenticationClass: [{ stimulusType: 'message', class: 'verified' }],
      eventIdAuthority: { mintedBy: 'registered scheduled package', uniquenessScope: 'job instance',
        replayWindow: 0, fallbackFingerprint: { policy: 'none', basis: 'occurrence hash' } }, ackPolicy: 'never',
    }, { profile: f.r.profile });
    const declarations = JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8')) as object[];
    const governance = f.govern([...declarations, scheduled]).governance;
    const register = f.context.decode.register, host = register.keys.host!;
    Object.assign(f.context, { decode: { ...f.context.decode, register: {
      ...register, entries: [...register.entries, 'scheduled-intake-v1'],
      keys: { ...register.keys, host: { ...host, adapters: [...host.adapters, 'scheduled-intake-v1'] } },
    } } });
    const schema: FactSchema = { ...f.f.schema, kind: 'scheduled-authority-evidence',
      fields: { role: { kind: 'text', maxLength: 40 } } };
    Object.assign(f.context, { schemas: [...f.context.schemas, schema] });
    const record = (role: string) => value(authorAndAppend({ kind: schema.kind, schemaVersion: 1,
      machine: f.deps.author.machine, principal: json(f.deps.author.principal),
      provenance: json(f.deps.author.provenance), at: json(f.f.now), body: { role }, required: [] },
    f.context, createFactStore(f.context, f.storage), f.deps.author.privateKey)).fact;
    const originalManifest = record('manifest:original'), originalAct = record('approval:original');
    const manifest = value(decodeScheduledWorkManifest({ ...clone(s.manifest),
      authority: { ...clone(s.manifest.authority), standingGrant: s.core.g.id },
      activation: { ...clone(s.manifest.activation), rollout: 'active' } }, s.context));
    let source = { manifest, namespaceVersion: 'scheduled:v1', installationId: 'install:a', identityEpoch: 'key:1',
      manifestFact: originalManifest.id, approvedActFact: originalAct.id };
    const act = { ...s.core.authorization, action: { kind: manifest.identity.jobId, scope: s.core.scope },
      artifact: manifest.identity.contentDigest } as Authorization;
    expect(isValid(act, act.base, manifest.identity.contentDigest, s.core.clock(100),
      { grants: [s.core.g], revocations: [] })).toBe('valid');
    const system = f.f.proof({ id: manifest.authority.systemPrincipal, kind: 'system' },
      { id: manifest.authority.systemPrincipal, kind: 'system' }, 'identity');
    f.syncCaptures();
    const make = () => {
      const adapter = createScheduledIntakeAdapter({ context: s.context, sources: () => [source],
        authorize: () => f.f.success({ act, grant: s.core.g, revocations: [],
          actFact: source.approvedActFact, manifestFact: source.manifestFact,
          scopeReference: manifest.authority.scope, currentBase: act.base }),
        verifySource: () => f.f.success({ ...system.input, adapter: 'scheduled-intake-v1' } as ProvenanceInput) });
      return value(createIntakePort({ ...f.deps, adapter, governance }));
    };
    const plan = value(createScheduledWorkPackagePort().planOccurrence({ manifest,
      namespaceVersion: source.namespaceVersion, installationId: source.installationId,
      scheduledInstant: '2027-01-01T00:00:00Z', asOf: s.core.clock(100) }, s.context));
    const route = { channel: `scheduled:${plan.jobInstanceId}`, sender: manifest.authority.systemPrincipal,
      identityEpoch: source.identityEpoch, eventId: plan.eventId };
    expect(value(make().receive(plan.tickBytes, route)).kind).toBe('admitted');
    const admitted = f.facts().find(row => row.kind === 'intake-admitted')!;
    expect(admitted.predecessors.required).toEqual(expect.arrayContaining([originalManifest.id, originalAct.id]));

    const replacementManifest = record('manifest:replacement'), replacementAct = record('approval:replacement');
    source = { ...source, manifestFact: replacementManifest.id, approvedActFact: replacementAct.id };
    expect(value(make().receive(plan.tickBytes, route)).kind).toBe('duplicate');
    const reconstructed = f.facts();
    const retained = reconstructed.find(row => row.id === admitted.id)!;
    const cone = causalCone(retained, reconstructed).map(row => row.id);
    expect(cone).toContain(originalManifest.id);
    expect(cone).toContain(originalAct.id);
    expect(retained.predecessors.required).not.toContain(replacementManifest.id);
    expect(retained.predecessors.required).not.toContain(replacementAct.id);
  });
});
