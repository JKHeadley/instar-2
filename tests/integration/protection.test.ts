import { expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import type { Hash } from '../../src/index.js';
import { createExternalProtectionBroker } from '../../src/verification/index.js';
import type { ProtectedLoaderPort, ProtectionJournalEntry, ProtectionJournalPort, VerificationHost } from '../../src/verification/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';

function protectionFixture(administration: 'independent' | 'agent-writable' = 'independent') {
  const f = factsFixture(); const path = '/operator/protected/policy.json'; let base = 'base:1';
  let effective: Hash = value(canonical('old-content')).hash; let installs = 0;
  const proposed = 'new-content', proposedHash = value(canonical(proposed)).hash;
  f.capture(value(canonical(proposed)).bytes);
  const auth = f.authInput({ id: 'protected-approval', requestedBy: f.bob, action: { kind: 'merge', scope: f.scope },
    artifact: proposedHash, base, kind: { kind: 'approval' } }, false, 'approval');
  const authorization = value(decode('Authorization', auth.input, { ...auth.context, currentBase: base, artifact: proposedHash }));
  const host: VerificationHost = { machine: 'machine-a', principal: f.bob, scope: f.scope, boundary: f.c,
    current: () => ({ decode: f.ctx.decode, clock: f.now, generation: f.ctx.decode.register.generation.id, stopped: false,
      facts: f.ctx, evidence: f.ctx.decode.evidence ?? [] }) };
  const entries = new Map<string, ProtectionJournalEntry>();
  const journal: ProtectionJournalPort = { owner: 'part-ten', administration,
    query: operation => f.success(entries.get(operation) ?? null),
    transact: (input, apply) => {
      const applied = value(apply());
      const entry: ProtectionJournalEntry = { ...input, effectiveHash: applied, disposition: 'committed', attestation: 'operator-service-signature' };
      entries.set(entry.operation, entry); return f.success(entry);
    } };
  const loader: ProtectedLoaderPort = { owner: 'part-ten', administration,
    protection: candidate => f.success({ exactPath: candidate, parentWriteDenied: true, symlinkSwapDenied: true,
      alternateLoaderDenied: true, debuggerDenied: true, rootPinned: true }),
    current: () => f.success({ hash: effective, base }),
    install: (candidate, expected, bytes) => {
      if (candidate !== path || expected !== effective) throw new Error('atomic expected-content mismatch');
      installs++; effective = value(canonical(bytes)).hash; return f.success(effective);
    } };
  const broker = createExternalProtectionBroker(host, journal, loader);
  return { ...f, path, proposed, proposedHash, authorization, broker, entries,
    effective: () => effective, installs: () => installs, moveBase: () => { base = 'base:2'; } };
}

it('P9-NF-53 P9-NF-55 an exact broker transaction is idempotent and queryable by original operation', () => {
  const f = protectionFixture();
  const request = { operation: 'install:1', path: f.path, base: 'base:1', proposed: f.proposed, authorization: f.authorization };
  const first = value(f.broker.install(request));
  expect(first.effectiveHash).toBe(f.proposedHash); expect(f.effective()).toBe(f.proposedHash); expect(f.installs()).toBe(1);
  expect(value(f.broker.install(request))).toEqual(first); expect(f.installs()).toBe(1);
  expect(value(f.broker.query(request.operation))).toEqual(first);
});

it('P9-NF-51 P9-NF-52 agent-writable administration is honestly unprotected and cannot install', () => {
  const f = protectionFixture('agent-writable');
  expect(value(f.broker.posture(f.path))).toBe('unprotected');
  refused(f.broker.install({ operation: 'install:1', path: f.path, base: 'base:1', proposed: f.proposed,
    authorization: f.authorization }), 'not independent');
  expect(f.installs()).toBe(0);
});

it('P9-NF-53 moved base and changed-content replay cannot slip through installation', () => {
  const f = protectionFixture(); f.moveBase();
  refused(f.broker.install({ operation: 'install:1', path: f.path, base: 'base:1', proposed: f.proposed,
    authorization: f.authorization }), 'base moved');
  expect(f.installs()).toBe(0);
});
