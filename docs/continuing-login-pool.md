# Continuing-session login pool

The conversation host uses `scripts/continuing-login-pool.mjs` through the optional
`prepareTurn` port in `production-conversation-session.ts`. It runs before a new
input is delivered, after the previous turn has closed. It uses the existing
reviewed login pool, its threshold (95% unless configured), its matched quota
snapshot and its durable holds. It never infers remaining quota from token counts.
A destination needs fresh readings below the threshold in both quota windows.
An unknown destination is not evidence of room. Unknown usage on a healthy current
login retains the existing provider-limit behavior.

The move stops the idle worker, copies its exact recorded transcript into the
selected login's home through the physical adapter, and resumes under a new
worker incarnation. An identical destination is reusable. A divergent copy stays
untouched; an absent, unsafe or unsupported copy clears only the resume reference
and uses the driver's existing journal-grounding continuation. The pool record
retains the copy outcome and whether continuity used the transcript or journal.
No credential is copied by this operation. The source transcript remains in place.

The host keeps the same admission claim, resource lease, deadline, intake identities
and reserved call allowance. It does not reopen the model checkpoint. Accounting
carries observed calls across homes and subtracts the destination's initial count
so a copied transcript is not counted twice. A prior measured count cannot be
lost with an evicted transcript. The journal's durable intake queue belongs to
the host; moving its worker does not recreate or empty that queue.

If every other login is full, unavailable or lacks a fresh reading, the worker is
not moved and the next input remains undelivered while the host waits. Stop and
the existing conversation deadline still apply. At that deadline this port closes
with an explicit uncertain outcome saying the input was not delivered; the journal
keeps the intake and outcome. This unit does not add unlimited continuation beyond
the conversation deadline: step1b-host-1013 owns that host lifecycle. Its merge
points are the optional `prepareTurn` callback before delivery, worker incarnation
selection, and the small session wiring block in `journal-agent.mjs`.

The 1.x procedure is reused in bounded form: `src/core/SessionRefresh.ts` copies
`projects/<project>/<session>.jsonl` before resuming and limits refresh attempts to
five per ten minutes. This pool keeps the same brake durably and uses only the
explicit source and destination homes, rather than searching unrelated accounts.
Known reset holds prevent repeated selection of a pressured account. All state
and copying are deliberately machine-local: an owning host alone may perform it.
Cross-machine copying of credentials or browser profiles is not introduced.

## Sign-in repair handoff

The pool reads the same identity-bound, non-secret 1.x account snapshot used for
quota. A matching `needs-reauth` lifecycle observation creates one durable repair
item per account and machine in `harness-login-pool.json` (`signinRepairs`). The
pool status exposes the account, machine and desk action. Generic errors, stale
quota alone, mismatched emails and duplicate identity matches do not create a
sign-in diagnosis. The item is a recorded repair request, not proof that repair
completed. The desk reconciles it after verifying the target login.

The repair itself remains the desk-run 1.x `/subscription-signin` procedure. Source:
this agent's `.claude/skills/subscription-signin/SKILL.md`, read for this unit.
No repair browser, real login or notification is started by this component.

1. Inspect `/subscription-pool`, `/subscription-relogin`, and
   `/subscription-pool/pending-logins` on the named machine. Bind the expected
   account to its own registered Google browser profile and vault reference names.
   Use the existing repair episode if one exists. In approval mode, the operator's
   Repair sign-in action is required; the agent cannot give that approval.
2. Instar starts the target CLI login with the existing account identity and its
   exact target configuration home. The browser only approves that login. An
   agent repair helper uses the already-started episode and does not enroll,
   cancel, reissue or complete another login itself.
3. Open that account's Chrome profile normally, without a DevTools or Playwright
   browser. On macOS the procedure uses a PID-targeted Apple Event to read the
   actual page and ordinary page or screen actions. Never operate another window.
   Check the page origin, expected email and requested permissions. Before typing,
   verify the exact Chrome PID and intended focused field. Passwords and second
   factors come from the vault through stdin; never print or store them in chat,
   files or command arguments. CAPTCHA, phone confirmation and operator-only
   permission changes go to the operator; do not bypass them.
4. For the code-return flow, the browser's returned code goes directly to the
   existing episode's protected code endpoint (or the desk's enrollment submit-code
   endpoint). For device login, use the code from the current live login pane,
   finish consent as the expected account, and let the existing episode observe
   completion. A desk-managed device enrollment also needs its complete endpoint.
5. Verify the identity and a real authenticated call, not just an active label or
   a login-status command. Refresh the real quota reading. Close only the browser
   opened for this repair. After two unsuccessful automated repair attempts, the
   skill directs one normal-browser manual attempt, then a recorded handoff.

For a 2.0 harness-user profile the desk must bind the repair to the reviewed
`profile.reference`, `expectedAccount`, machine, config home and runner-owned
custody record. The repaired credential must enter the existing harness-user
custody writer, never be passed in the session environment or command line. Then
rerun the existing profile/identity and activation checks as the harness user and
verify an authenticated call for that exact profile. A repaired original 1.x
account alone does not prove that a separate 2.0 custody copy was renewed. This
unit supplies detection and a desk item, not an automatic custody-renewal adapter.
