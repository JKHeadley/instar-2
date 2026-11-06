# Change review — publish train-186 cache repair evidence

Subject base: 9dcf967ed7d8cf69f9e44f8f9d5fea6f460cde3e
Review state: open
Reviewed content: none
Outcome: Publish generated register evidence for the committed signed-cache startup repair and measured native conformance.
Affected rules: 26, 37, 49, 69, 74, 90, 101, 105, 111, 113, 116
Affected floors: secrets — no credential changes; spend cap — unchanged; stop — unchanged; no duplicate sends — no dispatch; durable intake — unchanged
Operator questions: none
Suggested tier: local
Declared tier: local
Tier rationale: Derived register publication only; runtime repair reviewed in train-186-startup-cache-repair.md.
Side effects: Generated source and capability evidence now binds the repaired source commit; no new runtime behavior.
Undo and recovery: Revert this publication with its source repair and regenerate from the restored source.
Multi-machine posture: Shared derived repository evidence; each host retains its own profile and authority.
Layer below: Existing register replay generator, source commit 9dcf967ed, guarded native contract before 9/10 stale certificate only and after 10/10, affected tests 124/124 and actual unchanged profile inspection.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

1.x comparison: Inherit reviews/train-186-startup-cache-repair.md and owner 0c1d832a: actual main 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 src/, docs/specs/ and history searches show no matching signed-cache inspector; SessionManager.ts startup preservation and cli-login-expired-opens-repair.eli16.md corroboration inform diagnosis. Existing 2.0 owner repair and register publisher fit directly.

Publication: normal --replay from 9dcf967ed7d8cf69f9e44f8f9d5fea6f460cde3e produces generation ef061398b49b2900a986906f48867f40778455223771a018c7ce096350733826, 300 entries, 121 rules, 34 terms. No manual pin edits. Runtime/source tests unchanged since passing targeted verification. New answer and full suite remain automatic pipeline acceptance.

Subject: generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing committed-source publisher and review record. No new runtime machinery or authority.
80/20: Verify lint, register freshness, change-review and whitespace on the final head; do not repeat the prohibited full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
