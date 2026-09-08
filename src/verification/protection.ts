import { decode, isValid, scopeIncludes } from '../index.js';
import type { Hash } from '../index.js';
import { boundary, encoded, ensure, take } from './boundary.js';
import type { ExternalProtectionBrokerPort, ProtectedInstallationRequest, ProtectedLoaderPort,
  ProtectionJournalEntry, ProtectionJournalPort, VerificationHost } from './contracts.js';

export function createExternalProtectionBroker(host: VerificationHost, journal: ProtectionJournalPort,
  loader: ProtectedLoaderPort): ExternalProtectionBrokerPort {
  const independentlyProtected = () => journal.owner === 'part-ten' && loader.owner === 'part-ten'
    && journal.administration === 'independent' && loader.administration === 'independent';
  return Object.freeze({ owner: 'part-nine' as const,
    query(operation: string) { return journal.query(operation); },
    posture(path: string) {
      return boundary('ProtectionPosture', path, host.boundary, () => {
        if (!independentlyProtected()) return 'unprotected' as const;
        const p = take(loader.protection(path));
        return p.exactPath === path && p.parentWriteDenied && p.symlinkSwapDenied && p.alternateLoaderDenied
          && p.debuggerDenied && p.rootPinned ? 'protected' as const : 'unprotected' as const;
      });
    },
    install(request: ProtectedInstallationRequest) {
      return boundary('ProtectedInstallation', request, host.boundary, () => {
        ensure(!host.current().stopped, 'stop inhibits protected mutation');
        ensure(independentlyProtected(), 'external protection administrator is not independent');
        const protection = take(loader.protection(request.path));
        ensure(protection.exactPath === request.path && protection.parentWriteDenied && protection.symlinkSwapDenied
          && protection.alternateLoaderDenied && protection.debuggerDenied && protection.rootPinned, 'protected load/write bypass remains available');
        const proposedHash = encoded(request.proposed).hash;
        const current = take(loader.current(request.path));
        const authorization = take(decode('Authorization', request.authorization, { ...host.current().decode,
          provenance: request.authorization.explicitYes, currentBase: request.base, artifact: proposedHash }));
        ensure(host.current().decode.register.actions[authorization.action.kind]?.protected === true,
          'protected installation requires a protected registered action');
        ensure(authorization.approver.kind !== 'agent' && authorization.approver.id !== host.principal.id,
          'agent or requester cannot approve protected installation');
        ensure(authorization.requestedBy.id === host.principal.id && scopeIncludes(authorization.action.scope, host.scope),
          'authorization requester/scope differs');
        ensure(authorization.artifact === proposedHash && authorization.base === request.base && current.base === request.base,
          'artifact or base moved');
        ensure(isValid(authorization, current.base, proposedHash, host.current().clock, host.current().decode) === 'valid',
          'authorization is not currently valid');
        const requestDigest = encoded({ operation: request.operation, path: request.path, base: request.base,
          proposedHash, authorization: authorization.id }).hash;
        const prior = take(journal.query(request.operation));
        if (prior) {
          ensure(prior.requestDigest === requestDigest && prior.proposedHash === proposedHash && prior.path === request.path,
            'operation identity replayed with different protected content');
          return prior;
        }
        const entry = take(journal.transact({ operation: request.operation, requestDigest, path: request.path,
          base: request.base, proposedHash, authorization: authorization.id, priorHash: current.hash },
        () => loader.install(request.path, current.hash, request.proposed)));
        ensure(entry.operation === request.operation && entry.requestDigest === requestDigest && entry.proposedHash === proposedHash
          && entry.priorHash === current.hash && entry.effectiveHash === proposedHash && entry.disposition === 'committed'
          && entry.attestation.length > 0, 'broker journal/receipt differs from effective installation');
        return entry;
      });
    },
  });
}
