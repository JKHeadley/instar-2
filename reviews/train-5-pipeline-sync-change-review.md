# Change review — Preserve pipeline history and regenerate merged publication

Subject base: ef433e3c7780120afb01be4be51aa7ba722342ff
Review state: open
Reviewed content: none
Outcome: Preserve the remote pipeline merge/review history through 601b60dd49ad8ad66ea51f42fe309ee278a868cf using an ordinary merge; resolve only generated conflicts and replay the register against f83b7244593c19403c35366e1ae77190f9ac3d5d. No executable source or test differs from the previously tested ef433e3c tree.
Affected rules: 37, 49, 69, 74, 90, 91, 101, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake unchanged; generated publication is shape-only and grants no runtime authority
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Mechanical generated output and review metadata; approved policy and executable authority are not changed by this publication.
Side effects: Generated references now include the merged approved documents and retained branch declarations, bound to their committed source. Existing dark status and named holds remain visible.
Undo and recovery: Revert this publication with an ordinary commit, then rebuild against the intended committed source; preserve historical review and gate evidence.
Multi-machine posture: Generated repository artifacts travel with the branch. Targeted test logs and historical reports remain machine-local verification evidence.
Layer below: Merged source commit f83b7244; remote diff contains only generated publication and two existing review records; approved main document corpus; register-source/bootstrap-anchor.json; canonical conversion binding; generated/source.json replay provenance; existing register checks.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: Use the existing desk rehash/repin and register replay chain. No new production or gate machinery, quarantine or capability restriction.
80/20: 18 targeted baseline and changed-test files pass: 98 passing assertions, 41 explicit out-of-slice skips. Typecheck, build and document checks pass. Eight historical-report contract checks pass; P5, assembly and P11 require fresh revision-bound full-run process receipts supplied only by the post-push pipeline. Final cheap checks are recorded in external train-5 repair progress.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
