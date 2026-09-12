## 5. Identity, scope, and cross-conversation joins

**Rule — a join is evidence access, not a merged identity.** Rules 7, 28, 29, 31, 33,
89, 90, 103 and 104; **checks: P21-NF-06/07/09/12/18**. The governing conversation
contract is [Part 16 section 4](../16-conversation-adapters/04-durable-conversation-identity-and-binding-selection.md).
Its account/tenant, conversation tuple, sender and explicit alias mapping remain separate.
Part Twenty-One asks the owner for permitted related conversation handles; it never joins on
display name, text similarity, email spelling, a model's person guess or a retriever's graph edge.

The landed intake interfaces at `src/intake/contracts.ts:8–23` distinguish authenticated route
and sender evidence. They are not a general cross-channel person resolver. The required public
join/scope service is **NON-EXECUTABLE-UNTIL-INTAKE-CONVERSATION-RECALL-SCOPE** (section 14).
Fixtures may supply owner state to test a future consumer; production activation may not.

| Situation | Permitted interpretation | Prohibited shortcut |
|---|---|---|
| Same person in two verified accounts | Use the owner's explicit identity relation to search both permitted histories | Treat every similar handle as that person or merge their operator bindings |
| Two topics concerning one project | Search authorized related conversations while retaining each original topic/source | Merge conversations because one message refers to the other |
| Email exchange | Preserve authenticated account, original sender, quoted author, recipient set, thread/message ids and capture completeness | Treat a subject-line summary, draft, or forwarded quotation as a delivered exchange |
| Another agent reports an exchange | Recall the locally captured report as secondhand evidence; follow authorized references for originals if available | Claim this agent participated or assume the other agent's private history is locally available |
| Person A told the agent something private | Apply explicit permissions for internal use, provider disclosure and onward disclosure independently | Assume recognition authorizes use, or that hiding the source name makes disclosure safe |
| Later alias correction or identity churn | Append owner mapping evidence; invalidate affected caches and re-resolve current scope | Rewrite old authors or move old authority to the new account by name |

**Rule — filter before content crosses any boundary.** Rules 28, 29, 57, 86, 89 and 95;
**checks: P21-NF-06/07/12/18/19**. The source owner checks permissions before candidates
or content reach an adapter that is not permitted to see them, before each graph hop/hydration,
before summary construction, before embedding/reranking or model context, on cache reuse, and
again at final recipient binding. A recipient-only output filter is too late. Unauthorized
source existence, hit counts, names and graph topology are themselves protected metadata.

The P21 coordinator receives only authorized candidate handles and policy-limited diagnostics.
Separate restricted audit records may distinguish `scope-filtered` from `unavailable`; the
recipient-visible status uses a policy-approved abstraction that does not expose forbidden
existence. A malformed or permissive adapter result is revalidated against the source owner
before hydration. An adapter's claim that it already filtered is not sufficient.

Internal use without onward disclosure is a distinct mode, not the default implication of
memory ownership. The owner must explicitly authorize the principal/provider to receive that
content and constrain the resulting output. Until a composed consumer can enforce the approved
mode, the material stays out of that principal's context. The safe alternative is to use a
separately authorized shared lesson or public support path. An allowed intermediate graph node
does not authorize reading its private neighbors or publishing an inferred private fact.

**Rule — consent and authority are current, history is preserved.** Rules 7, 28, 42, 90,
93, 95 and 104; **checks: P21-NF-07/10/11/12**. Revocation invalidates current access and
effect eligibility through its owner; it does not erase the original exchange. Old approval
text may locate the governing authorization fact but cannot replace current resolution of scope,
expiry, revocation or effect parameters. A direct experience, observed transcript, indirect
report and derived belief retain their distinct provenance after summarization and migration.

Mixed-source projections inherit the intersection of contributing permissions for the proposed
use. A public lesson derived from private evidence requires an explicit declassification/share
decision under the owner policy; merely removing names does not declassify it. Where allowed,
authorized auditors retain private provenance while ordinary consumers receive only the approved
lesson. If provenance cannot be retained or disclosed under the governing custody policy, the
limitation is explicit and the lesson cannot assert independently verified original support.

**Value — the person test respects whose experience it was.** The default promise is useful
recall of this agent's retained, permitted direct exchanges and accurately attributed reports.
It does not promise omniscience about another agent's unseen conversations. The separate use
and disclosure decisions in section 15 make this boundary reviewable. Source evidence for why
these distinctions matter is [R1 §§3.6–5](research/01-instar-1x-memory.md),
[R2 §§2–4](research/02-dawn-grounding.md), and
[R5 §§4, 8–10](research/05-proposals-and-evaluation.md).
