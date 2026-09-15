import { canonical, decode } from '../../src/index.js';
import type { Hash } from '../../src/index.js';
import { createOperatorSurface } from '../../src/operator/index.js';
import type { ProtectionReceiptView } from '../../src/operator/index.js';
import { createExternalProtectionBroker, probeBoundToCurrentEvidence } from '../../src/verification/index.js';
import type { ProtectedLoaderPort, ProtectionJournalEntry, ProtectionJournalPort } from '../../src/verification/index.js';
import { value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { operatorFixture } from './fixture.js';

export type ProtectionReceiptPatch = Readonly<Partial<Record<keyof ProtectionJournalEntry, unknown>>>;

export function round17ProtectionFixture(patch: ProtectionReceiptPatch = {}, brokerOutage = false) {
  const operator = operatorFixture(), verification = verificationRuntimeFixture();
  const plan = verificationInput('VerificationPlan'), probe = verificationInput('ProbeRecord');
  value(verification.runtime.record('VerificationPlan', plan));
  value(verification.runtime.record('ProbeRecord', probe));
  operator.setClock(100);
  const receipt = {
    operation: probe.operation,
    path: probe.subject,
    requestDigest: value(canonical({ operation: probe.operation, path: probe.subject, base: 'base:1',
      proposedHash: plan.bar.subjectDigest, authorization: 'authorization:1' })).hash,
    base: 'base:1',
    proposedHash: plan.bar.subjectDigest,
    authorization: 'authorization:1',
    priorHash: plan.bar.subjectDigest,
    effectiveHash: plan.bar.subjectDigest,
    disposition: 'committed',
    attestation: 'broker-receipt',
    ...patch,
  } as unknown as ProtectionJournalEntry;
  const journal: ProtectionJournalPort = {
    owner: 'part-ten', administration: 'independent',
    query: () => brokerOutage
      ? decode('Scope', { type: 'Scope', schemaVersion: 1, kind: 'project', members: [] },
        operator.context.decode) as ReturnType<ProtectionJournalPort['query']>
      : verification.success(receipt),
    transact: () => { throw new Error('round-17 receipt fixture is read-only'); },
  };
  const loader: ProtectedLoaderPort = {
    owner: 'part-ten', administration: 'independent',
    protection: path => verification.success({ exactPath: path, parentWriteDenied: true, symlinkSwapDenied: true,
      alternateLoaderDenied: true, debuggerDenied: true, rootPinned: true }),
    current: () => verification.success({ hash: plan.bar.subjectDigest as Hash, base: 'base:1' }),
    install: () => { throw new Error('round-17 receipt fixture is read-only'); },
  };
  const broker = createExternalProtectionBroker(verification.host, journal, loader);
  const verificationPort = { ...verification.runtime,
    probeBound: (fact: string, at: ReturnType<typeof operator.history.clock>) => {
      const rows = value(verification.runtime.inspectCurrent());
      const row = rows.find(candidate => candidate.fact.id === fact);
      const current = verification.host.current();
      return verification.success(!!row && row.record.type === 'ProbeRecord'
        && probeBoundToCurrentEvidence(plan, row.record, at, current.evidence, current.decode,
          current.facts, verification.host.boundary));
    },
  };
  const composition = { ...operator.composition, witnessFreshness: 100, broker, verification: verificationPort,
    isolation: { owner: 'part-ten' as const, live: () => operator.f.success(true) } };
  const surface = value(createOperatorSurface(composition));
  const protection = (): ProtectionReceiptView => value(surface.protection(probe.operation, probe.subject));
  return { operator, verification, plan, probe, receipt, composition, surface, protection };
}
