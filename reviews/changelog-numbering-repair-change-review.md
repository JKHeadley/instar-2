# Change review — one proposed changelog numbering reconciliation

Subject base: d3d563cd1c2396a72bf08fc08c7a7740be419ca8
Review state: open
Reviewed content: none
Outcome: Prepare the single merge of published main into live for the operator's review; retain both histories and every approved body sentence.
Affected rules: 4, 37, 49, 74, 82, 90, 91, 94, 95, 101, 111, 112, 113, 116, 119, 123
Affected floors: secrets — untouched; spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched
Operator questions: Approve the exact Rule 94 numbering waiver below before landing? Landing requires the operator’s approval recorded on the waiver line below; this record alone authorizes no push or release.
Suggested tier: critical
Declared tier: critical
Tier rationale: One exact exception to preservation of numbered governed history; no new rule wording.
Side effects: Bare live-number lookups move according to the map. Main's published numbers, entry payloads, status, causes and provenance stay intact. Historical SHA-qualified references remain valid. Generated register outputs incorporate main's Rule 123 and retain live's Rule 72 sentence.
Undo and recovery: Discard this unlanded branch. After an approved landing, any reversal must preserve published history and obtain its own authority; this exception cannot authorize another transition.
Multi-machine posture: Deterministic Git comparison on every machine, using full commit and blob identities; no remote mutable state or host-specific exception. No runtime state is introduced.
Team posture: Repository readers see this proposal under existing repository access. Only the operator approves the waiver and the desk lands it; no member or guest gains access or action authority.
Layer below: Both complete constitutions at frozen main; the accepted changelog-numbering-design-1109-PROGRESS.md; actual arrays from both parents; Rule 91 renderer/validator; governedVersionErrors and the read-only merge-history guard. Main Rule 39 and Rule 123 and live Rule 72 are preserved byte-for-byte as rows.
Bug class: integration
Bug evidence: reproducer=tests/register/change-review-git.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Prompt review: No model prompts, output parsers or model accept/escalate/refuse decisions change.
Constitution counterpart: none; this merges previously approved wording without changing obligations. Rule 123's existing counterpart is 1.x 818107de4 (#3046); main's review record is retained.
Rule 94 waiver: proposed bc95ab494d5c035f750c6efc1379913e2d8b6e46 d3d563cd1c2396a72bf08fc08c7a7740be419ca8
Decision: rule90-D1 | Recognize the exact proposed repair for history validation only; operator authorization before landing remains outstanding. No draft-status exemption or general renumbering support. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule90-main-reconcile-1111-PROGRESS.md
Decision: rule90-D3 | 2026-11-11 (rounds 2/3): Supersedes rule90-D1: refuse the proposed waiver until the operator approval artifact is recorded; excuse only the four suffix comparisons at the pinned repaired state, never a missing body version. Pin the remaining tree and review text except the waiver line; keep fixtures and pinned instructions valid across approval. Restore the landing predicate import. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule90-main-reconcile-r3-1111-PROGRESS.md
Decision: rule90-D2 | Reuse main's complete anchor roster and publication metadata, retain live's shape, and recompute hashes through repository canonical/bootstrapDeclarations, then regenerate the register from a committed source. This accommodates approved Rule 123 without changing the desk pipeline's deliberately strict same-roster merger. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule90-main-reconcile-1111-PROGRESS.md

Landing this also puts the Rule 72 deadline sentence on main for the first time; changelog entries 24 and 25 are status draft, "code-owner approval and merge pending".

The change-review check fails until the waiver line records the operator’s approval. The exact approval form is `Rule 94 waiver: approved <M> <L> <approval-artifact>`, using the full frozen SHAs below and one non-whitespace artifact reference. The independent landing review must verify that artifact records the operator’s approval. Only that line may change without renewing this exact exception.

The approval line is written by whoever records it, and nothing in the checker can prove the operator approved; what ties landing to the operator is that this pull request can only merge with the operator’s own GitHub review on its final head, and the line should cite that review and the Telegram message of his answer.
The `freeze` command edits this record’s "Review state:" line and would therefore switch the exception off: do not freeze this record before it lands.

The two copies of the history assigned different numbers to some entries. This proposal keeps the numbers already published on main and places the live-only entries above them, in their existing order. It changes 38 labels and keeps every entry's words, dates, status and links. No rule is rewritten or newly approved. The old live labels remain findable at the frozen live commit and through the map below. The operator must approve this particular exception before it can land.

Frozen main M: `bc95ab494d5c035f750c6efc1379913e2d8b6e46`.
Frozen live L: `d3d563cd1c2396a72bf08fc08c7a7740be419ca8`.
The table records Git blob IDs, including all whitespace. All old labels in the maps mean L:path:revision; all new labels mean this repair's path:revision. Main changes zero labels. Entries absent from a map keep their labels. Titles below are the complete first `changes.what` of each entry; all other changes within that entry are also retained.

| Changelog | Main blob | Live before blob | Repaired blob | Labels changed from L |
|---|---|---|---|---|
| `docs/01-the-rules.changelog.json` | `13a8a88b76e5bba6b9cfcbdab43a3be7609179bf` | `1acf4d13d8b67647a300dbcec45c6272a4f00222` | `0a24ebcf2e4020e7d98346fc0fcef6c6a922dbf4` | 3 |
| `docs/14-the-assembly.changelog.json` | `5d9d7401a2b0ce6e3183d019305de314450b08a9` | `a0f29b651750162437289699c65ff34c54ae6150` | `ac6d0724de956bbd1b2fde3b05e9688a3fafe957` | 7 |
| `docs/15-the-operator-surfaces.changelog.json` | `f8d4f3974e6a0cd88a0b6d456ad87610c29cc35b` | `f0905d8ecd0ae7b01ddebc970238cb5fd69fa865` | `3630347890514b18a9768074b2dd4879ebd0d105` | 4 |
| `docs/17-harness-adapters.changelog.json` | `c21eb7bd8b11b7e038171c889be0a8b7495b4aea` | `96bc9a6e6eabf990419075f628f2aa2995933070` | `638c946d6ea6c258aaf59dc3e2c19d9b0c53789e` | 24 |

## docs/01-the-rules.changelog.json

| Old → new | Entry title |
|---|---|
| 24 → 25 | Restore Rule 72's approved check sentence: "A deadline that has passed fails only builds that change the feature it belongs to, and puts an item in front of the operator; every other build keeps moving." |
| 23 → 22 | Strengthen existing foundational Rule 39 Observability with measurable outcomes, recorded baselines, versioned repeated evaluations, understandable visual history, whole-effort and material-part coverage, independent coverage checks and accountable recurring corrective review. |
| 22 → 24 | Rule 72's check states the deadline effect: "A deadline that has passed fails only builds that change the feature it belongs to, and puts an item in front of the operator; every other build keeps moving." |

## docs/14-the-assembly.changelog.json

| Old → new | Entry title |
|---|---|
| 28 → 24 | Specify platform-neutral installation guarantees and concrete macOS/Linux implementations, including headless Linux and named build units. |
| 27 → 23 | Connect preparation to the concrete genesis chain and split milestones from the first broker isolation unit. |
| 26 → 22 | Define supervised ordinary installation, evidence ordering, explicit overrides and four bounded build units. |
| 25 → 28 | The accepted-reply projection renders the accepted answer without the preview label. |
| 24 → 27 | Operator question 2: a conversation keeps its private workspace, bounded by its fixed-size volume and the root's count of kept workspaces, and a harness session that is only a cache of the journal, replaced whenever a journal fact, the authority or the harness changes. |
| 23 → 26 | Operator question 2: the preview's tools are on by default under the operator's recorded grant, run under Part Thirteen's demonstrated boundary, and send every consequential effect to the effect doorway. |
| 22 → 25 | Operator question 2 states that the preview's ordinary scoped tools are supported ordinary work under Part Thirteen's demonstrated boundary (admission hook, harness sandbox, clean environment), which is not §4 confinement and grants no governed or protected status. |

## docs/15-the-operator-surfaces.changelog.json

| Old → new | Entry title |
|---|---|
| 11 → 10 | Specify platform-neutral installation guarantees and concrete macOS/Linux implementations, including headless Linux and named build units. |
| 10 → 9 | Specify protected Mac selection of the provider-authenticated phone account and copied-code refusal. |
| 9 → 8 | Define authenticated mobile pairing and device-loss recovery through the existing custodian surface. |
| 8 → 11 | Section 2: the operator dashboard is a page of the registered approval surface, opened only by its enrolled passkey through a sign-in typed apart from every act; it shows status, waiting requests with direct links, recent messages, allowance and the stop, completes no authority, renders an untrusted bounded snapshot with its age, and is held by eleven floors with negative controls. |

## docs/17-harness-adapters.changelog.json

| Old → new | Entry title |
|---|---|
| 26 → 4 | Specify platform-neutral installation guarantees and concrete macOS/Linux implementations, including headless Linux and named build units. |
| 25 → 3 | Define separate OS custody, account-at-use evidence and independently recoverable installation material. |
| 24 → 26 | §9 tool rule: file reads and searches reach what a sandboxed command may read (the conversation's volume and the system files), writes and edits the volume, each decided on the resolved file and handed to the harness as that path; the sandbox reopens the root-level links to its system files as links only. |
| 23 → 25 | §9 tools-on-by-default: the operator's standing full-tools grant may name the policy class full-tools-checkpointed-v1 instead of one build's policy digest; a tools policy is in the class only when the build's own generated per-turn settings and arguments keep every checkpoint (admission hook on every call, confined shell whose read exceptions stay in the workspace and reviewed runtime list, the Codex provider routed through the turn's model checkpoint, no skip flags, caps at the reviewed ceilings). With no covering grant the preview runner refuses to start rather than running text only; only an explicit --tools off runs text only. |
| 22 → 24 | §9 tool rule, checkpointed route: the confined shell's one network path is the turn's egress checkpoint; a network read the effect policy names, Codex's web calls included, goes to the doorway; and the checkpoint's effect owner decides a consequential tool by the four tests under the current effect policy and its grants, adding the stop, durable preparation and the never-twice identity. Revision 19's statement that the owner consults no grant and that the shell has no network is withdrawn. |
| 21 → 23 | §9 tool rule: a doorway whose harness has no model-call limit of its own (the Codex tool turn) runs the same admission hook through the host's admission checkpoint: its subagents spend the turn's one allowance there, its commands run under the confined sandbox profile with no network, and a consequential tool passes the checkpoint's effect owner, which consults no effect-policy grant and admits only an exactly registered operation; the web-read host rule holds on that route too. |
| 20 → 22 | §9 gains the rule that the registered Codex model doorway answers only a tool-free completed turn: the terminal event, one agent message within bounds, every item an agent message or reasoning, no unreadable line; a completed turn that ran a command is refused, a failed turn carries the provider's own reason, and an unexplained outcome stays uncertain. The invocation passes and sets no API key. |
| 19 → 21 | §9 tool rule: a shell network write is the effect doorway's `tool:network-write` on its host, decided by the four tests with the turn's admission config (operations, the operator's effect policy, the irreversible term); a shell read of a host the policy registers or marks policy-sensitive goes to the doorway as a web read of it does; the shell's home directory is new each turn, also in a kept workspace. |
| 18 → 20 | §9 native tool rule: the owner's membership covers the worker's sandbox instance, read by the owner from outside the workload, so a descendant that takes a new session, loses its parent and leaves the volume is counted against the ceilings and ended by the stop and the cleanup; nothing inside the sandbox and no file the workload can write takes part in settlement or cleanup; each call's containment evidence is the owner's cleanup verdict and the membership it was proven under. |
| 17 → 19 | §9 native tool rule: the owner's membership is named as observation; every descendant of a native worker is ended through the worker's sandbox instance (its sweeper signals every process of that instance when the worker ends, however it ends, and the launch completes only after the sweep); each call's containment evidence reaches the native result, which lists every launch whose end was not proven. |
| 16 → 18 | §9 native tool rule: every admitted call except a web fetch runs as a sandboxed worker process launched through the host resource owner (memory, process, CPU and handle ceilings, deadline, stop, verified cleanup); a web fetch ends on its deadline or the stop and reads at most its byte limit; a call admitted while the stop was latched is never run. |
| 15 → 17 | §9 gains the native tool rule: Instar runs the tool turn's agent loop itself, with each step a text-only model call under its own separately bound native framing; proposed calls pass the same admission hook, call slots and record and run in the same scratch volume, the shell under a sandbox built from the harness sandbox's read list; the loop is the tool turn's own invocation, so reservation, step bound, trace, consistency check and stop are unchanged. |
| 14 → 16 | §9 tool rule: a sandboxed command reaches the network through the turn's egress checkpoint (a loopback proxy started and stopped with the turn, HTTPS intercepted with the turn's own trust root, hosts resolved and required public, reads admitted, every other request a network write for the effect doorway, bounded, every decision recorded) instead of having no network; the checks name tests/preview/egress-proxy.test.ts. |
| 13 → 15 | §9 tool rule: the effect doorway decides by the purpose's four consequential-effect tests (not operation membership) for every effect the full tool set sends it; a web read or listed MCP read whose effect or target the operator's effect policy registers or marks policy-sensitive goes to the doorway too. |
| 12 → 14 | §9 persistent-workspace rule: only prose notes (plain-text and Markdown files) are edited by removing a forgotten or corrected clause; structured files are kept intact and named; the workspace note is delivered in the turn's own input; a file held by an earlier part of a bounded walk stays named until a whole walk completes. |
| 11 → 13 | §9 persistent-workspace rule: only plain-text files are edited by removing a forgotten or corrected clause; any file the pass cannot change safely is kept intact and named in a workspace note; the bounded pass resumes over later turns; the forget is recorded reconciled only after a whole walk leaves no file holding it, and the status shows an unfinished check. |
| 10 → 12 | §9 persistent-workspace rule: a new session removes every earlier session file of the conversation's projects directory; before a turn's tools run, clauses the journal forgot or corrected are removed from the workspace's files; a workspace the journal shows used that comes back empty and unmarked is recorded as lost, never resumed against, and its replacement carries a note. |
| 9 → 11 | §9 gains the persistent-workspace and kept-session rule: one 128 MB volume per conversation kept for the root's life (at most four per root; further conversations run in one-turn workspaces, journaled; nothing deleted to make room); a Claude Code session named per turn, resumed only while the authority, harness, model and a digest of every journal fact it may hold are unchanged, replaced at six turns, 512 KiB, a compaction, a loss or an unsettled turn, and ended at a stop, withdrawal or failure; machine-local, never resumed across machines; Codex cell unsupported. The tool rule's workspace and the grant's scope now name the conversation's workspace. |
| 8 → 10 | §9 tool rule: the pinned harness's whole built-in tool set is offered and no tool is left out to hold a safeguard; the admission hook decides each call by its class (ordinary work including notebooks, bookkeeping and in-workspace worktrees; the effect doorway for sends, schedules, remote triggers, design syncs, unsandboxed and monitor commands and unlisted MCP calls; a budget refusal for a workflow or skill whose agents cannot be reserved before dispatch; refusal of an unclassified tool), and a subagent may start its own within the turn's one reserved budget. |
| 7 → 9 | §9 tool rule widened to the full tool set (WebFetch and WebSearch reads of public hosts, one bounded foreground subagent type recorded as a Rule 114 edge, the root's MCP servers with reads listed and every other MCP call at the doorway); the grant rule makes tools on by default under the recorded grant, derived at launch, refusable, and withdrawn live when the record or the sealed authority's resolution changes; every cleanup census reclaims each member it finds. |
| 6 → 8 | §9 scoped-tool rule: ordinary in-workspace work is admitted without a doorway call, and a tool that could make a consequential effect goes to the effect doorway, which admits or refuses it by the four consequential-effect tests under Part Twelve's live-path tool rule. |
| 5 → 7 | §9 scoped-tool rule: the hook no longer judges a command by its words; the sandbox refuses reads from the filesystem root down except the turn scratch volume and the runtime system files, writes outside that volume, network, unix sockets and signals to other processes; the workspace and all shell and harness temporary files live on a fixed-size volume; the per-step call count is allocated atomically. |
| 4 → 6 | §9 gains the preview scoped-tool rule (Read, Write, Edit, Glob, Grep and Bash through the reused harness under the demonstrated boundary of admission hook, sandbox and clean environment; whole-liability call reservation; journaled trace; existing reply path) and the tool-grant rule (scope, custodian, withdrawal within the declared cancellation bound). |
| 3 → 5 | Initial Part Thirteen design: the session harness adapters. |

## Consumers and 1.x comparison

The accepted design's citation inventory still applies: reviews/rule72-scope-1108-change-review.md and reviews/train-228-repair-092911-change-review.md retain historical live numbers; reviews/observability-improvement-evidence-change-review.md's Rule 39 revision 22 is restored to main's address. Earlier Part 17 review numbers and the changelog's own references describe earlier branch history, so their prose is preserved rather than rewritten. Consult their source commits plus this L-based map. No numeric selector in generated output, tests or the anchor is migrated; generated content binds bodies and hashes.

1.x FIRST: searched actual JKHeadley/instar main `3ae8208a69b027ad465dca78ec7db2eb2c16b66e`, verified with ls-remote, across src/, docs/specs/ and registry/parser Git history, including 818107de4, 480fbbc5a and 333ca6556. Read src/core/StandardsRegistryParser.ts:18–45 and docs/specs/standards-conformance-gate.md:50–70. Reused stable provenance and preservation of history; those owners parse articles, not two divergent numbered arrays, so they do not supply this merge. ONEX-LESSONS.md:125–142 reinforces preserving source history, reconciling authorities and migrating consumers. The 2.0 renderer, validator, canonical declaration generator and suffix checker remain the owners.

Round 2 inherits that comparison and rechecked those 1.x source/spec paths at the same revision, their history (05d490cbf and ab26b7ca3), and ONEX-LESSONS.md:125–142. The repair keeps the existing checker and its real-history fixtures. No document body, changelog data, anchor or generated file changes in this round.

Round 3 inherits and rechecks the same 1.x revision, source/spec paths, history and lessons; it restores the landing import and decision history and makes fixtures and pinned instructions valid across approval. Exact commands and exit codes: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule90-main-reconcile-r3-1111-PROGRESS.md.

## Verification

Round 1 evidence remains in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule90-main-reconcile-1111-PROGRESS.md. Round 2 commands and exit codes are in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule90-main-reconcile-r2-1111-PROGRESS.md: the real Git fixture derives its subject from the diff, exercises the reviewer’s three body edits, added governed files, later entry/record edits, and missing/proposed approvals, alongside the old controls. Direct and symlinked CLI paths must both reject unknown commands. This author record alone establishes neither independent convergence nor operator approval.

## Closing block

simplestRobustRoute: Keep main's complete suffix, place live-only entries above it, render with the existing tool, and permit only four exact suffix exceptions with recorded operator approval, both ancestor commits, and exact tree and review-text pins. The tree digest binds every path, mode and blob ID except this checker, its test and this separately pinned record. Only the waiver line is excluded from the review-text pin. These pins prevent body changes, added governed files and record reuse; the body-version check always runs. This is the simplest robust route. No pipeline changes or new runtime mechanism are introduced.
80/20: Real histories and negative neighbors cover the repair; existing tests retain the general preservation rule. Data, renders and evidence dominate the diff; the checker stays small; the additional tests reproduce the independent findings and prove both acceptance and refusal.
VERDICT: landing requires the operator waiver and independent review; this author record alone authorizes neither landing nor release
