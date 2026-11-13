/** Custody-side adapter for the carried 1.x repair lifecycle. The host supplies its existing
 * admission, child-run, browser registry and credential custodian owners. These ports are not
 * implemented by a model, read from a repair row, or created by claiming approval in prose.
 * A deployment must bind them to its installed owners before scheduling repairs. */
import type { RepairLease, RepairTarget, SigninRepairPort } from './signin-repair.js';
import { SIGNIN_REPAIR_LIMITS } from './signin-repair.js';

type SigninOutcome = Awaited<ReturnType<RepairLease['normalSignIn']>>;
export interface RepairProfile {
  reference: string;
  account: string;
  machine: string;
  ownership: 'agent' | 'person';
  registered: boolean;
  revision: string;
}
/** This lease comes from the installation's existing admission checkpoint. Acquiring it reserves
 * spend and capacity and durably records a bounded child under the owning run BEFORE runNormal.
 * current rechecks role, stop, grant expiry, run ownership and the recorded profile revision. */
export interface AdmittedRepairRun {
  owner: string;
  machine: string;
  account: string;
  profileRevision: string;
  deadline: number;
  helper: { account: string; healthy: boolean };
  current(): boolean;
  runNormal(input: { target: RepairTarget; candidate: string; method: 'normal'; fallbackCodes: 'forbidden';
    deadline: number }, signal: AbortSignal): Promise<SigninOutcome>;
  /** Quiescence is checked by exact child identity, never a process-name pattern. */
  quiescent(signal: AbortSignal): Promise<boolean>;
  close(): void;
}
/** Candidate references are opaque custody handles, never credential, cookie or token values.
 * The candidate is isolated from the live login. publish is compare-and-swap against the live
 * slot revision captured by open; a competing renewal/refusal cannot be overwritten. */
export interface RepairCandidate {
  reference: string;
  account: string;
  current(): boolean;
  identity(signal: AbortSignal): Promise<'match' | 'mismatch' | 'unknown'>;
  use(signal: AbortSignal): Promise<boolean>;
  publish(signal: AbortSignal): Promise<boolean>;
  close(): void;
}
export interface SigninRepairHost {
  now(): number;
  machine: string;
  stopped(): boolean;
  profile(target: RepairTarget): RepairProfile | null;
  /** Updated only by custody/approval intake; opaque hash, never raw input. */
  resumeRevision(target: RepairTarget): string | undefined;
  admit(target: RepairTarget, profile: RepairProfile, bounds: { deadline: number; method: 'normal'; fallbackCodes: 'forbidden' },
    signal: AbortSignal): Promise<AdmittedRepairRun | 'busy' | 'unavailable' | null>;
  candidate(target: RepairTarget, run: AdmittedRepairRun, signal: AbortSignal): Promise<RepairCandidate>;
}

export function createAdmittedSigninRepairPort(host: SigninRepairHost): SigninRepairPort {
  // One helper per host adapter; the independent admission owner holds the machine-wide bound.
  let occupied = false;
  return {
    stopped: host.stopped,
    resumeRevision: target => host.resumeRevision(target),
    async acquire(target, signal) {
      if (host.stopped() || signal.aborted || target.machine !== host.machine) return 'unavailable';
      if (occupied) return 'busy';
      target = Object.freeze({ ...target });
      const registered = host.profile(target);
      const profile = registered === null ? null : Object.freeze(structuredClone(registered));
      if (!profile?.registered || profile.ownership !== 'agent' || profile.account !== target.account
        || profile.reference !== target.profile || profile.machine !== host.machine) return 'unavailable';
      occupied = true;
      let run: AdmittedRepairRun | undefined, candidate: RepairCandidate | undefined;
      let released = false, verified = false, used = false;
      const close = () => {
        if (released) return;
        released = true;
        try { run?.close(); } finally { try { candidate?.close(); } finally { occupied = false; } }
      };
      const deadline = host.now() + SIGNIN_REPAIR_LIMITS.lifetimeMs;
      const current = () => {
        try {
          return !released && !host.stopped() && !signal.aborted && host.now() < deadline
            && run?.current() === true && host.now() < run.deadline && candidate?.current() === true
            && JSON.stringify(host.profile(target)) === JSON.stringify(profile);
        } catch { return false; }
      };
      try {
        const admitted = await host.admit(target, profile, { deadline, method: 'normal', fallbackCodes: 'forbidden' }, signal);
        if (!admitted || typeof admitted === 'string') { close(); return admitted; }
        run = admitted;
        if (signal.aborted || host.stopped() || run.machine !== host.machine || run.account !== target.account
          || run.profileRevision !== profile.revision || !run.current() || !Number.isSafeInteger(run.deadline)
          || run.deadline > deadline || run.deadline <= host.now() || !run.helper.healthy
          || run.helper.account === target.account) { close(); return 'unavailable'; }
        candidate = await host.candidate(target, run, signal);
        if (!current() || candidate.account !== target.account) { close(); return 'unavailable'; }
        const activeRun = run, activeCandidate = candidate;
        return {
          owner: run.owner, machine: host.machine, deadline: run.deadline,
          profile, helper: run.helper, current, close,
          async normalSignIn(abort) {
            if (!current() || abort.aborted) return 'uncertain';
            // Only normal sign-in is expressible. The helper gets references, never secret material.
            return activeRun.runNormal({ target, candidate: activeCandidate.reference, method: 'normal',
              fallbackCodes: 'forbidden', deadline: activeRun.deadline }, abort);
          },
          async revalidate(abort) {
            if (!current() || abort.aborted || !await activeRun.quiescent(abort)) return 'unknown';
            const identity = await activeCandidate.identity(abort);
            if (!current() || abort.aborted) return 'unknown';
            // Absence/unknown is NOT proof that no earlier login ran. Never restart on that inference.
            return identity === 'match' && await activeCandidate.use(abort) ? 'signed-in' : 'unknown';
          },
          async verifyIdentity(abort) {
            if (!current() || abort.aborted) return 'unknown';
            const identity = await activeCandidate.identity(abort);
            verified = current() && !abort.aborted && identity === 'match';
            return current() && !abort.aborted ? identity : 'unknown';
          },
          async authenticatedUse(abort) {
            if (!verified || !current() || abort.aborted) return false;
            used = await activeCandidate.use(abort) === true && current() && !abort.aborted;
            return used;
          },
          async publish(abort) {
            if (!verified || !used || !current() || abort.aborted) return false;
            return activeCandidate.publish(abort);
          },
        };
      } catch { close(); return 'unavailable'; }
    },
  };
}
