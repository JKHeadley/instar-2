# Change review — train-159 live merge repair

Subject base: acef940af33a38590d661db15c624338d37c498e
Review state: open
Reviewed content: none
Outcome: Merge live 85901ea7f into train-159, preserving review evidence and resolving the two qualification-record conflicts.
Affected rules: 26, 37, 49, 74, 90, 91, 101, 102, 111, 112, 113, 116; purpose Rules 2 and 3.
Affected floors: secrets — no credential or custody changes; spend cap — no inference or paid calls; stop — no runtime changes; no duplicate sends — no serving effects changed; durable intake — all journals and checkpoints unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Both heads have identical product code and tests; repair merges review metadata and regenerates derived publication only.
Side effects: Review ancestry now includes both histories. Losing the Linux opt-in disclosure would make historical evidence incomplete; retaining it does not skip a new test or claim physical qualification.
Undo and recovery: Revert the merge through the ordinary release process and regenerate publication, preserving both original branch histories. No runtime state migration.
Multi-machine posture: Git transports the merged record; WSL checks do not claim Studio physical qualification. Reports remain local for desk copying to their named Studio destinations.
Layer below: Full origin/main purpose and rules; both conflict sides; original skip declarations; ordinary git merge; committed-source register generator. No source, test, governed document or changelog behavior changed.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath checked and unset; common hooks directory contains samples only.
Convergence: none
Decision: train-159-repair-193339-D1 | Retain both qualification records' Linux physical-proof opt-in disclosures and merge live assessment metadata; deduplicate its identical assess-1025b-R2 entry without changing the decision. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-159-repair-193339-PROGRESS.md
Decision: train-159-repair-193339-D2 | Regenerate derived publication using the existing committed-source generator after the ordinary merge; preserve product and changelog bytes without adding runtime machinery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-159-repair-193339-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing generated prerequisite states remain evidence, not new promises.

Review coverage: The inherited assessment record gains explicit dispositions for five unchanged prompt/test overlaps brought into its subject by this merge; source bytes remain unchanged.
Publication: Regenerated with scripts/build-register.mjs --replay from merge 941f0080fe46b3742381ef333a1b66b6490aed37; no pin edited by hand.

simplestRobustRoute: This is the simplest robust route: an ordinary merge retaining both review histories, followed by the existing register generator. No new mechanism. Clean original branch and exact live head are start guards; ancestry, unchanged product bytes and existing checks are end guards; no runtime floors change. No unattended installation completion is claimed.
80/20: Repair only the actual metadata conflicts and derived output, then submit portable checks to the Studio gate without duplicating its full suite.
VERDICT: author submission; no independent verdict asserted
