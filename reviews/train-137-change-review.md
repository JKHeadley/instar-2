# Change review — train-137 intake recovery integration

Subject base: ca3d8ab80f606ce490c2883e71b6b5ab2a93d154
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed intake recovery head onto the pinned live base, retaining durable holds until recorded successors and regenerating the register.
Affected rules: Purpose Rules 2 and 3; Rules 26, 33, 35, 36, 42, 46, 49, 55, 60, 61, 63, 68, 69, 70, 74, 90, 101, 102, 111, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain the member's existing enforcement and tests. No new dispatch or model call is introduced by integration.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of the existing journal recovery repair; no additional product behavior.
Side effects: Durable hold visibility remains until the existing reservation, intent or recorded settlement clears it. Same-reason holds retain their age. See the member review for concurrent observer and preparation effects.
Undo and recovery: Revert the member repair and regenerate the register; no schema migration. Preserve recorded receipts and uncertain-effect fencing.
Multi-machine posture: Unchanged journal ownership, replication and fencing. Retry eligibility stays local to a drain pass and does not authorize another owner.
Layer below: Inspected the pinned member diff, its restart regression and report, durable successor and hold settlement, and existing register replay and owner-pin tools. Base is an ancestor of the exact reviewed member; no conflicting product changes were resolved.
Bug class: durability
Bug evidence: reproducer=tests/preview/intake-survive.test.ts; restart=tests/preview/intake-survive.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory contains only sample hooks.
Convergence: none
Decision: train-137-merge | Ordinary merge of reviewed intake-survive-1022s 2c002d4dd060bdb7a7965c7bf9b18539ef98557e; fast-forward from exact live base. Member evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/intake-survive-1022s-PROGRESS.md (snapshot sha256 37f1ae84e7a16d4fda5fae1eea08924b14b7d455ea864c5667c04f5675f6db18). Carry its limitation: the two unidentified live overdue turns remain unverified. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-137-PROGRESS.md
Decision: train-137-A | Preserve the member bytes and live base behavior unchanged; no overlap conflicts or hand edits to product files. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-137-PROGRESS.md
Decision: train-137-B | Start the new branch at ca3d8ab80f606ce490c2883e71b6b5ab2a93d154 and retain ancestry; do not move it or merge a newer unreviewed tip. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-137-PROGRESS.md
Decision: train-137-D | Apply the explicit WSL exception to macOS-bound and e2e/integration checks; report failures in untouched host-dependent tests without repairing them here. Studio gate owns those results. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-137-PROGRESS.md
Decision: train-137-desk | Run the existing repin/build/rehash/register replay chain from cint-L37-PROGRESS; repin and rehash change zero pins. Publish generated output from exact reviewed head. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-137-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing declaration wording regenerated without changing its meaning.
Prompt review: Integration adds no model-facing wording or parsing. Member repair retains the existing prompt, parser and verdict policy. Replay recorded proof-room updates 1016101/1016102 and answer output 1016104 plus existing journal corpus through targeted tests; no new live operation is claimed.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged runtime no-tools instruction carried from the reviewed member.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged memory-list response carried from the reviewed member.
Prompt finding: e8708c7fea24 | quoted-evidence | Unchanged recall instruction and negative-control evidence carried from the reviewed member.
Verification: Targeted direct consumers, journal corpus and required pinned checks run on the integrated tree; full outputs and exclusions are recorded in the train report. Full combined suite belongs to the Studio gate.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary fast-forward of the reviewed repair followed by existing desk regeneration tools. No additional queue, state, timer or retry mechanism. Existing ownership, stop and spend checks guard the start; durable successors and receipt fencing guard completion; existing resource bounds and unknown-send fences remain intact. Recorded-input worker replay is evidence of recovery, not proof of completion of the two unidentified live turns.
80/20: Preserve the reviewed fix, verify its direct consumers, publish a clean candidate and leave live acceptance to the desk. No independent convergence claimed here.
VERDICT: author submission; independent review belongs to the desk
