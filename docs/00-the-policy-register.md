**Status: approved. Governed.**

# The operator policy register

This document sits beneath the purpose. It records the choices the constitution deliberately leaves to the operator per deployment: the defaults an Instar installation runs with until its operator changes them, and the choices an operator must make explicitly before a capability is on. Nothing here is constitutional. A policy may vary between deployments; the principle it serves may not. Every entry is a **Value** (an operator choice) and names the purpose principle it serves; an entry that would need to bind every deployment belongs in the purpose instead, and is rare.

Entries are numbered P-01 onward. "Default" is what ships. "Per deployment" states what an operator may change and how the change is recorded (a versioned entry in this register for that installation).

---

## Protection and approval (serves: the agent never administers its own safeguards)

**Value — P-01 deployment trust record.** Default: protected execution uses a small broker under an operator-controlled identity the agent cannot administer, and the operator accepts a written deployment record naming the machines, administrators, keys and the accepted residual risk of administrator or root loss. Per deployment: the operator names the custodian and signs the record.

**Value — P-02 approval gesture.** Default, for every deployment: an explicit operator yes is a reply from the verified operator account in the operator's own bound chat, recorded with the message id, with no setup. Where a recorded P-05 grant lets the agent speak through the owner's chat account, that reply cannot tell the operator from the agent, so the yes is instead an Approve tap on a GitHub page under the operator's account, reached by a direct link sent each time. Recovery is the platform's normal account recovery; GitHub account recovery covers a lost phone. No passkeys, no signing key, no repository setup. The accepted residual: whoever takes over that account, or the agent's own intake, can approve within the bound authority, not only steer it. Per deployment: the operator may instead name a signed device-factor route and its recovery.

## Disclosure (serves: least revelation)

**Value — P-03 receipt audiences.** Default: on an open transport an unresolved stranger receives no unsolicited acknowledgement; in a group the private receipt goes only to the verified bound person; an approver's name is not disclosed to others. Per deployment: a public-facing installation may widen acknowledgements after recording the audience it accepts.

**Value — P-04 chat steering exposure.** Default: steering approved work from a chat channel is allowed only after the operator records and accepts the exposure that a compromised chat token would create. Per deployment: the acceptance record, or refusal, is the operator's.

## Outward exposure (serves: nothing outward by default)

**Value — P-05 personal-account grants.** Default: use of a person's own messaging account starts as a reply-only grant naming the account, recipients, channel and actions; starting new conversations is a separately named capability. Per deployment: the grant text.

**Value — P-06 public ingress.** Default: no installation exposes an inbound conversation endpoint to the internet; an operator who does records the public surface, the custodian, the capture-before-acknowledgement guarantee and the recovery obligation. Per deployment: the ingress record.

**Value — P-07 process observation.** Default: beyond the three required watchers, only the stuck-session watcher and the idle-session cleanup may read the full process inventory, each for its registered recovery decision. Per deployment: adding a reader is an explicit widening the operator records.

## Durability of irreversible acts (serves: an irreversible act follows its durable cause)

**Value — P-08 replica count.** Default: when a second machine is enrolled, a non-emergency irreversible effect has a local durable authorization and causal preparation plus one acknowledged copy on that independently failing peer before dispatch. A supported single-machine installation has no peer dependency; at install time its operator accepts once the fixed profile's closed local-durable operation set and permanent-machine-loss model. An operation that demands replication still requires the second-machine peer, and loss of an enrolled peer never selects local durability automatically. Per deployment: the peer count or the accepted single-machine profile policy.

**Value — P-09 active-tier retention.** Default: bounded payload retention refers to the fast, readable tier; before that tier releases a source, unique or pinned evidence moves into a tested lossless archive with a durable locator, and admission of new capacity is accounted for. Per deployment: tier sizes and archive location.

## Standing suggestions (serves: automatic suggestions never widen themselves)

**Value — P-10 candidate presentation.** Default: an automatically derived standing candidate is shown only when the same classified need recurs within its window, and never proposes more than the authorization it came from. Per deployment: the recurrence window.

## Operating choices without a single principle (each names the purpose text it stays within)

**Value — P-11 supported harness modes.** Default: accept the measured confinement and observation overhead of modes that prove their contracts within approved budgets; accept a provider that may lose its saved conversation when authoritative history survives locally and the replacement re-grounds; accept a paid mode whose provider caps total charge even when billing settles late. Serves: coherence (history survives) and the spend boundary (a cap is a named level). Per deployment: which modes are enabled.

**Value — P-12 Slack unit of work.** Default: the thread is the unit of work and authority; the channel supplies background through an attributable handoff; a channel-wide assignment is deliberate and recorded. Serves: one conversation keeps its own commitments (coherence). Per deployment: none expected.

**Value — P-13 semantic-gap ceiling and watch-only trials.** Default: the temporary semantic holding gaps named by the run-graph design expire on 2026-10-05 at 00:00 UTC; a new safety capability may run a watch-only trial with a feature-specific deadline, and a trial never removes existing enforcement. Serves: nothing that mattered is silently lost. Per deployment: trial deadlines.

**Value — P-14 incident attention.** Default: after self-repair fails and any bounded delivery observation ends unresolved, one grouped action-needed notice per incident, at most two pushed notices per rolling hour per operator; unchanged status is never pushed. Serves: the agent is reachable without flooding the person. Per deployment: the hourly ceiling.

**Value — P-15 automatic recovery classes.** Default: none. Automatic recovery authority grows one evidenced, reversible, low-risk kind at a time, each grant naming actions, scope, limits and whether it covers restart or half-open retries after a breaker opens. Serves: the agent does not widen its own authority. Per deployment: the granted kinds.

**Value — P-16 maintenance share under load.** Default: under sustained heavy demand with eligible upkeep waiting, at least 20 of every 100 start credits go to maintenance after emergency, stop, diagnosis and repair reserves are protected, and ready urgent work starts within 60 seconds. Serves: reachability and coherence over time. Per deployment: the share and the latency target.

**Value — P-17 intake bundle adoption.** Status: pending operator adoption. Five intake changes (the authority-conferring versus directive exercise split; the bound-operator glossary clause; the parser fields for authentication class, event-id authority and acknowledgement policy; parser and acknowledgement conformance) landed in code without an explicit operator approval record. Adopting them as one bundle is an operator act recorded here; landing is not consent.

**Value — P-18 competing permitted harms.** Adopted by the operator on 2026-09-14 (Part Twenty-Three, OD-08). Default: decide unresolved conflicts individually; preserve the competing supported claims and continue help that does not depend on settling them. Serves: the purpose’s wisdom Value and authority constraint. Per deployment: the operator may record a scoped priority policy with affected situations, limits, challenge route and later outcome review. No priority creates source permission or constitutional authority.

**Value — P-19 observable implications of private use.** Adopted by the operator on 2026-09-14 (Part Twenty-Three, OD-09). Default: keep a use unavailable when its audience-visible implications are outside verified source permission; other permitted help continues. Serves: [least revelation](00-the-purpose.md#the-purpose). Per deployment: the operator records any narrower source/use/audience tolerance only with the source authority’s verified permission and enforceable limits; unknown scope remains unavailable. No universal numerical risk allowance is implied.

## The commons (Part Twenty-Two; adopted by the operator on 2026-09-14)

**Value — P-20 release evidence profiles.** Default: each kind of commons release has its own evidence and risk profile, approved before a real trial; a profile's targets are experiment settings, not measured results, and no profile may relax the privacy or authority floors. Serves: "Who decides what" and the evidence constraint. Per deployment: the profiles and their targets.

**Value — P-21 commons retention terms.** Default: balanced terms. Temporary search copies are discarded after 90 days; supporting files are reviewed for removal after 14 days; once an allowed removal proceeds, copies in backups under our control are removed within 30 days. The clocks start when the service first accepts the material and are not restarted by copying, retrying or restoring. Permanent case history is never deleted and getting old is never a removal reason. Statistical aggregate sharing stays disabled until its privacy-loss budget is separately approved. Serves: the permanent-memory posture (rule 7), within the fact and verification retention contracts. Per deployment: the three terms.

**Value — P-22 release and trial mandate.** Default: release approval stays with the operator until a scoped, revocable delegate is named; the first trial is the two-choice local replay, with $500 of additional provider spend as a proposed ceiling to present against, never permission to spend; reviewer time is agreed before work begins; no fresh-work trial runs until its spending, participants and reviewer time are separately presented and approved. Serves: the operator-only authority and spend boundary. Per deployment: the delegate, if any, and the approved budgets.

---

**Rule — engineering defaults are not in this register.** Missed-occurrence handling for scheduled runs and repeated civil time after a clock change are the agent's engineering defaults, recorded in the scheduled-work design and changed by measurement. **Check:** an entry here that names no operator choice fails review.
