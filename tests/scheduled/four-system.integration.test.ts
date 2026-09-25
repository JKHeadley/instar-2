import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { ProvenanceInput } from '../../src/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { intakeFixture, message } from '../intake/fixtures.js';

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
});
