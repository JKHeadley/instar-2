# Change review — guidance-only tools grant

Subject base: 51d31871f1d6ac8611b5ae61a43b32b70119c63d
Review state: open
Reviewed content: none
Outcome: A new sealed tools-guidance-only-v1 disposition admits guidance edits while pinning every execution field; the earlier sealed digest grant keeps its exact subject.
Affected rules: Rules 4, 18, 26, 28, 36, 41, 49, 58, 60, 74, 82, 90, 95, 98, 101, 103, 104, 111, 112, 113 and 116; purpose standing-role and sign-off rules.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake remain enforced. Tool set, permission mode, caps, runtime and checkpoint settings are exact sealed pins.
Operator questions: none; observer #391 authorizes a new disposition under Justin's recorded messages 121996 and 121586 in topic 102965. The existing sealed grant is not reinterpreted.
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes deterministic admission of explicitly recorded standing authority, with no model prompt, model-output parser or reply judgment changes.
Side effects: Guidance-only grants require the full policy and sealed pins; old builds refuse the new class. Existing digest grants and the broader full-tools-checkpointed-v1 retain behavior. Unknown policy fields are included in the pins. Missing, malformed, changed or tampered evidence refuses.
Undo and recovery: Revert the resolver change and select the previous authority file. The new authority is a separate desk file; no launcher was switched. No old grant, revocation or installation acceptance was edited.
Multi-machine posture: Policy comparison is deterministic across machines; actual execution and operator-record verification remain installation-local under the existing preview authority seal. No new replicated state, account or remote capability is introduced.
Layer below: Read purpose and rules in full; inspected live sealed grant, actual authenticated operator-message/provenance/binding records, class resolver, generated checkpoint settings, full invocation digest, and journal-agent seal-authority command used by the desk grant helper.
Bug class: integration
Bug evidence: reproducer=tests/preview/tools-policy-class.test.ts

Evidence details: Actual train-42 policy digest matches the live sealed grant. Completion-guidance head 7661a99b has different prose and digest but equal pinned execution fields; it refuses under the old record and resolves under the new sealed class record offline. Committed captures replay both real policy shapes. Negative tests change every non-policy subject, every policy field and cap, tools, permission mode, subagent execution settings and generated checkpoints. Exact-digest resolution remains green. No live provider call or deployment proof is claimed.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Inherited declarations are mechanically replayed; publication adds no deferred work.

Decision: guidance-only-class | Reuse the existing sealed class-grant path with a new versioned class and exact policy/checkpoint projection; source citations and actual record evidence live in the desk progress report. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/grant-class-1015-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: one new case in the existing class resolver, with canonical pins excluding only system and subagent guidance prose. The broader existing class cannot prevent changes to tools or lower caps; silently aliasing the sealed digest would alter its recorded scope. Existing seal, authenticated source, grant liveness, exact subject checks and invocation digest guard entry; explicit pins and refusal tests guard the boundary. The actual candidate policy resolves offline. This is not an unattended model-execution or deployment claim.
Publication: Regenerated the seven existing publication artifacts from source commit d4e15d413a7498d56c721db60b266735e81254eb using the existing replay generator; no declaration or approval was changed.

80/20: Targeted direct consumers, exact recorded policy replay, architecture, typecheck, lint, register and required pinned tests; the pipeline owns the full suite.
VERDICT: author submission; the independent desk records its own review
