# Change review — Install the document review checker dependencies

Subject base: aa8cbc934351f78e52d4ecebc3714648981ece0f
Review state: frozen
Reviewed content: sha256:7980c327c7f574aab00d6746f34ab3a07a2221dbf635c4ac81e685a3338294ce
Outcome: The existing document-checks job installs its declared locked dependencies and audits the actual submitted revision, while its earlier document checks continue to validate the merged tree.
Affected rules: 73 (a check must run), 74 (existing review record), 37 (exact-tree full gate remains required), 101 (protected workflow review remains required).
Affected floors: secrets — no new credentials or output; spend cap — no change; stop — no change; no duplicate sends — no messaging added; durable intake — untouched.
Operator questions: Existing protected /.github/ path still requires the operator's approving review; no approval or merge is claimed.
Suggested tier: significant
Declared tier: ordinary
Tier rationale: A small workflow setup correction satisfies existing dependency and authored-revision preconditions, with no new runtime, threshold, permission, rule or state migration. Reverting the workflow changes fully removes the correction. The path-based significant signal is retained for audit.
Side effects: Earlier document and whitespace checks still run on the default merged checkout. Only the final provenance review selects the platform-provided pull-request head SHA (or actual pushed SHA); it neither exempts authored commits nor changes the checker. A clean hosted runner now downloads the existing package-lock dependencies, as the repository's type-check workflow already does. Installation can fail visibly; no existing check is skipped, reclassified or made optional. Normal locked dependency installation has its usual package lifecycle behavior; this change grants no extra workflow permissions or secrets. There is no operator product UI.
Undo and recovery: Revert the install step and review-only revision selection. No production state is changed. Existing CI run logs preserve failures and the initial missing-dependency result remains evidence.
Multi-machine posture: Hosted runners resolve the same checked-in lockfile; agent deployments and peer reads are untouched. The local clean-install drill ran Node24 on macOS, not the hosted Linux/Node22 runner, so a fresh actual workflow result remains required.
Layer below: Checked package.json's TypeScript devDependency, package-lock.json, scripts/change-review.mjs lazy createRequire, the tracked document-checks setup and the existing types-checks npm ci step. Repair the missing dependency setup rather than weakening the review parser or governing rules.
Bug class: integration
Bug evidence: reproducer=.github/workflows/document-checks.yml; live=/Users/adriana/echo-compute/echo/.instar/state/improvement-evidence-139374/book2-ci-clean-install-drill.json
Hook bypass: none
Convergence: none

Subject (1 paths): .github/workflows/document-checks.yml

## Evidence and plain-language explanation

The document checks prepare Node, validate the changelogs and then ask the
production review checker whether each change has its required review record.
That last checker parses JavaScript and TypeScript source using the TypeScript
package. The repository already declares and locks that package, but this job
never installed it. On a fresh hosted runner it therefore stopped before it
could decide whether the review records were valid. The actual PR194 job
127849346817 stopped with the missing module at 2026-11-06T12:02:57Z.

This change installs the existing locked dependencies immediately after Node
setup, before any document check. The existing document checks keep their order and requirements.
Only the final provenance check selects the actual submitted revision, because
GitHub's synthetic test merge is not an authored commit and has no review record.
The earlier checks still validate the merged content. On push, the actual pushed
commit remains the reviewed subject; real unreviewed merge commits are not exempted. A dependency installation failure remains a failure; a missing or
invalid review record remains a failure; the genuine Slack evidence deadline
remains a separate failure. The paired constitutional wording is not edited by
this workflow repair. A clean temporary-directory drill used the production
parser: before installation it failed to load TypeScript, the locked install
completed, and the same parser call then succeeded. That drill created no
production records and its temporary directory was removed. It proves this
setup precondition, not a full suite or hosted workflow pass. The operator's
protected-path review and the exact-tree landing gate still apply.

## Hosted follow-up finding

The first hosted candidate installed dependencies and reached the real checker.
It then rejected GitHub synthetic merge43da3d67154c, which is not a submitted
source commit. The final review step now checks the platform-provided PR head,
without changing any earlier merged-tree check. Actual head25c3f5d41 passed the
native check; its synthetic merge failed only this provenance test. The full
landing gate still requires exact-tree verification and operator review.

GitHub documents the distinction between the temporary merge SHA and the
actual pull-request head in its [workflow event reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).

## Independent review

The first independent review of the dependency-only candidate concurred after inspecting all subject
content, the actual hosted failure, the clean-install parser drill and six side-effect
lenses. Its own verdict artifact names frozen subject digest
`sha256:01ab47fc0c89b4810e3397cd85d195de11a86df4acdd06bb182ff2ecb6405938`.
It confirmed the workflow is the actual integration reproducer. No blocking
findings were reported. This is not operator approval or a full-gate pass.

## Closing independent review

The second review was required by the actual hosted synthetic-merge finding.
Reviewer review_history concurred with the expanded setup correction at frozen
workflow digest `sha256:7980c327c7f574aab00d6746f34ab3a07a2221dbf635c4ac81e685a3338294ce`.
It explicitly verified earlier merged-tree checks remain intact, actual pushed
commits stay checked, and hosted/fullgate/operator requirements remain pending.
No implementation or review limit for the separate failed proposal changed.

## Closing block

simplestRobustRoute: Install the existing locked dependencies and bind the provenance check to the actual platform-named authored revision. Keep the earlier merged-tree document checks, the checker itself and all landing requirements unchanged.
80/20: Actual hosted failure plus a clean-install production-parser drill establish the missing precondition and its repair. No mirror test of workflow text is added for this small reversible workflow change. Independent review and the real hosted rerun remain distinct evidence.
VERDICT: author submission; no independent approval or landing admission is claimed
