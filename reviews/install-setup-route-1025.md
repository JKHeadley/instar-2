# Change review — setup supervision route

Subject base: 206bc77026aae10e4acb3ae6b177f2d0882295c8
Review state: open
Reviewed content: none
Outcome: Give the setup-supervisor build units a concrete CPU-only candidate and qualification plan while preserving constitutionally required supervision. Design only; no running prompt, decoder, acceptance path or runtime implementation changes.
Affected rules: 4, 26, 28, 34, 36, 38, 41, 49, 55, 57, 58, 60, 65, 67, 70, 74, 75, 90, 91, 95, 98, 100, 101, 102, 111, 113, 116; purpose independent safeguards, durable cause and single-machine operation.
Affected floors: secrets — isolated custody, scrubbed model input and no key export; spend cap — no paid route or subscription authority; stop — durable stop checked before and during each step; no duplicate sends — unchanged send owners and exact operation identity on resume; durable intake — preserved input and checkpoints on holds.
Operator questions: none; option (b) is authorized by the brief. Rule 38 requires a model for identity/security pipelines. Replacing it with deterministic-only supervision would require Justin's constitutional change and is not proposed.
Suggested tier: ordinary
Declared tier: significant
Tier rationale: Design of a critical preparation route needs independent review, but this diff executes no model, changes no running system and claims no implementation readiness.
Side effects: Build units must populate executable/library/adapter/prompt hashes and earn host and adequacy evidence before release. The named small model and proposed resource ceiling might fail qualification; the design explicitly keeps that result a hold rather than weakening safety. Publication source pins may need regeneration.
Undo and recovery: Supersede this design through a new changelog revision; retain history and regenerate publication pins. No runtime state changed. Preparation resumes only after reconciling actual owner receipts.
Multi-machine posture: CPU process, limits and custody handles are deliberately machine-local. The profile works on one Mac or Linux host without a peer. Authority/history remain with Two and existing replication policy; a recovery backup is not a peer.
Layer below: Full purpose and rule book, glossary critical definition, Part Ten bootstrap/manual-placement boundaries, parts 06/08/15/17-03 existing authority/custody references, predecessor audit snapshot, 1.x deterministic setup state machine, credential-storage interface/SecretStore and SecretDrop handoff behavior. Official Qwen GGUF metadata supplies exact model revision/hash/size; upstream llama.cpp tag resolves to the pinned source commit. Neither proves setup judgment adequacy.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: install-setup-route-D1 | Choose option (b): Rule 38 plus the glossary requires supervision for identity/security preparation; Rule 4 exact checks and Rule 116 simplicity do not waive it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-setup-route-1025-PROGRESS.md
Decision: install-setup-route-D2 | Qualify one pinned Qwen2.5 1.5B Q4_K_M CPU route through Seven with finite limits and independent acceptance; release artifact hashes and measured results remain build outputs, never invented proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-setup-route-1025-PROGRESS.md
Decision: install-setup-route-D3 | Reuse checkpointed exact checks and verify-before-consume, with paired real evidence and held-out replay; preserve enrollment, custody and first-grant owners without cross-reference churn. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-setup-route-1025-PROGRESS.md

## Constitutional finding

Rule 38: “Every critical pipeline has at least a light model watching each step and validating it.” The glossary makes identity/security consequences critical. Purpose requires independently held safeguards but names no model. Part 14 chooses a local model to avoid the subscription bootstrap cycle. Deterministic-only verification would contradict Rule 38, even though exact postconditions are mechanically checkable. The constitution is unchanged.

## ELI16

Setup creates the agent's identity and recovery keys. The rules require a small AI checker to watch those important steps. The design names one small model to test on a normal computer, specifies what it must check, and tells an independent reviewer how to decide whether it is good enough. It has not passed that test yet.

## UX Impact

The installer chooses and supplies the model automatically on Mac or Linux, without a GPU or subscription. The person gets no model-selection task. Failed or interrupted checks retain progress and show a resumable hold. Download size and bounded validation time are real costs; actual timings must be measured before shipping. Existing pairing and approval steps remain unchanged.

## Closing block

simplestRobustRoute: Use one small local model through existing Seven plus exact owner checks and checkpoints; this is the simplest route preserving Rule 38 and avoiding the first-subscription cycle. No new judgment engine, server, approval class or paid fallback is added. Start guards are verified artifacts, bounded preparation authority and resources; end guards are exact durable receipts plus validated step results; stop and failure preserve work. No autonomous shipped-path completion is claimed by this design unit.
80/20: The route names a testable candidate and rejection bar rather than building a model-selection framework. Host/resource and judgment adequacy are deliberately unmeasured until the named build units produce real evidence, as required by the brief.
VERDICT: author submission; independent review pending
