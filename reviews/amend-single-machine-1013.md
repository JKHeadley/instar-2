# Change review — single-machine functionality

Subject base: 7ef8f158d4129a4cf90cf3c546701f32e348fdd3
Review state: open
Reviewed content: none
Outcome: Correct the purpose and P-08 so every operation the granted role calls for may run local-durable on a single-machine installation, preserving the complete cause before the effect and one accepted installation loss model. Version both governed documents. List downstream design and runtime consumers for the desk without implementing them in this wording-only unit.
Affected rules: Purpose fully-functional and supported-deployment Rules, durable cause, role grants, sign-off and amendment authority; Rules 1, 4, 18, 45, 49, 63, 74, 82, 90, 91, 98, 101, 102, 103, 104, 109, 111, 113, 116. Preserve checks and safety floors, replace the deployment-specific list with the general principle, retain prior history, verify briefing consumers and leave exact-head approval to the owner.
Affected floors: secrets custody, spend cap, stop, durable intake, effect uniqueness and no duplicate sends remain explicitly enforced. No runtime safeguard is edited or activated.
Operator questions: Justin's Approve on the exact pull-request head is required before landing this constitution amendment. No merge is authorized by this builder brief.
Suggested tier: critical
Declared tier: critical
Tier rationale: the scope is small but changes the governing purpose and installation policy.
Side effects: downstream effect, assembly and operator-surface designs still encode the old provider/reply list; the PR inventory identifies their follow-up. Source briefing pins quote unaffected excerpts and require verification, not blind repinning. This change alone does not enable additional runtime effects.
Undo and recovery: supersede the amendment with a new governed version if needed, preserving approval and changelog history; regenerate any affected publication artifacts. No deployed state migration is involved.
Multi-machine posture: local-durable cause and accepted permanent-machine-loss model with one enrolled machine; replication demands begin with the second enrollment, default replicated(1), and cannot silently drop after peer loss. A second process is never a peer; effect uniqueness remains required.
Layer below: full docs/00-the-purpose.md and docs/01-the-rules.md from origin/main; P-08; both Studio independent design-set reviews; docs citation search; source/effect and assembly closed-set consumers; tests/preview/briefing.ts and its constitution sync tests; governed-document and changelog checkers; register replay source binding.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: role-wide-local-durability | replace the closed operation list rather than move it into P-08; keep role grants, sign-off, full local cause, one accepted loss model and all named floors. P-08 holds replica policy and installation/profile acceptance, never an operation-kind limit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/amend-single-machine-1013-PROGRESS.md
Decision: downstream-scope | inventory citing designs and runtime consumers in the PR without rewriting them; the brief explicitly assigns this unit only the constitutional correction and necessary pin alignment. No runtime availability claim. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/amend-single-machine-1013-PROGRESS.md
Decision: briefing-pins | retain existing excerpt pins because the edited single-machine paragraph is outside every SOURCE_EXCERPTS selection and the rule book is unchanged; verify sourcePacket and verifyMindRules against actual repository bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/amend-single-machine-1013-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: correct the two governing paragraphs and the obsolete provider/reply cross-reference, version their histories with the existing renderer, verify current briefing consumers and inventory downstream work; add no runtime machinery or gate. Exact-head owner approval is the landing guard; the safety, authority, durability and resource floors remain intact. This documentation submission claims no unattended runtime result.
80/20: narrow author submission for the desk and owner; verification results and unrun host-dependent checks are recorded in the report.
VERDICT: author submission; independent landing review and owner approval pending
