# Change review — bind the R30e unit assessment to its actual base

Subject base: 852578a48e7d240b51e576aa4b439a42df6bb29b
Review state: open
Reviewed content: none
Outcome: correct the unit evidence scope to 1c3447786f1ca9721b4b6b58774edc51eb59b1a3..852578a48e7d240b51e576aa4b439a42df6bb29b; retain the train's separate evidence.
Affected rules: 26, 37, 49, 74, 101, 102, 107, 108, 111, 112, 113, 116
Affected floors: secrets — no credential access; spend cap — no paid calls; stop — unchanged; no duplicate sends — no sends; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: evidence-scope correction only; no product or test behavior changes.
Side effects: the desk unit launcher now honors the existing optional reviewBase field, as the combined launcher already does. A queued desk patch binds w4-rule30 to its exact original parent. Omitted or empty reviewBase retains the existing merge-base fallback. The original NO review is preserved, never rewritten as YES.
Undo and recovery: revert the review clarification and the one-line desk launcher change; clear only this item's reviewBase through desk-item.py. The incorrect broad range returns, so another unit approval must not rely on it.
Multi-machine posture: committed evidence travels with git; the launcher and item patch are deliberately machine-local desk artifacts under the absolute lanes directory. No product state changes or peer dependency.
Layer below: inspected launch_unit_review, start_astra and review-common.sh: the unit launcher passed an empty base, which selected merge-base with origin/main; REVIEW_BASE already supports exact bases. Git confirms the original parent-to-head range has only the two claimed files. The supplied independent assessment supports this scope, while its native runtime failures remain red evidence for the combined/live gates.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: rule30-repair-binding | honor the existing reviewBase at the unit launcher and set the exact original parent through the desk patch queue; preserve the original reviewer verdict and separate train evidence | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule30-repair-PROGRESS.md
Deferral: none

Subject (0 paths): review records only; desk changes and their replay are recorded in the repair progress report.

## Closing block

simplestRobustRoute: pass the existing explicit base through the unit launcher and record the narrow immutable range; this is that route, with no product rewrite or new approval machinery. Existing review header and post-check bind the resulting base/head; targeted replay checks explicit, empty and absent bases. No product completion or independent YES is asserted.
80/20: the single must-fix is the review binding; reuse the supplied assessment and preserve its execution limits. Mandatory cheap checks are separate from a full combined-build or live proof claim.
VERDICT: author submission; independent review belongs to the desk
