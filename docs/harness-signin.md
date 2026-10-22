# Repairing an installed Claude login

The installation owner can run:

```sh
instar2 signin /absolute/installation installed-profile-reference /absolute/account-browser-profile
```

The browser directory must already be a private, dedicated Chrome profile for that
account. The command remembers that binding in its repair record; subsequent runs
can omit it. An existing `signinBrowser: { account, directory }` binding on the
installed login also works. The normal personal Chrome profile is refused. Neither
the agent's selected model nor its account grants change.

The command first checks the installed credential against the provider. Only an
actual authentication refusal starts sign-in. A missing credential, unavailable
network or missing endpoint permission remains unknown. A different account or
organization is held for the installation owner to reconcile.

Sign-in opens normal Chrome with that account's profile. Complete the provider's
offered controls there. No password, token or code is printed or requested in the
terminal. The native CLI runs `auth login` in a separate private home and stores its
credential in its own macOS Keychain slot. This implementation uses neither a
debugging connection nor synthetic browser input. It leaves the browser window
open; it never closes a browser which may now belong to the person signing in.

Before publishing the replacement, Instar checks the provider's live account and
organization identity and makes one authenticated quota call. A successful CLI exit
alone is insufficient. The replacement is written durably to the existing harness
custody and read back. No model call, message send or input replay is involved.
The credential's expiry and the existing escalating reminder schedule are recorded;
these reminders use the pool's existing bounded reply-notice surface. Native refresh
credentials remain in Keychain. This slice does not add automatic token refresh.

The pool excludes an account with an unresolved repair. A successful repair leaves
the ordinary authority, readiness and quota checks in control; it cannot erase a
later sign-out observation or a usage hold. Continuing workers are not killed or
restarted by this command. Their next ordinary admission reads the restored custody.

Each invocation has a ten-minute ceiling. Stop or a changed installed binding aborts
the CLI and prevents publication. Process termination targets only the CLI it
started. An interrupted browser step is re-observed before any publication, never
blindly started again. A normal unsuccessful attempt can be re-entered to verify a
credential that arrived late. A process crash leaves its account/browser locks
visible: the installation owner must establish that the original processes ended
before releasing those locks. There is no automatic stale-lock takeover or blind
sign-in retry. Wrong-identity refusals remain held.

`scripts/claude-signin-repair.mjs` ports the small 1.x repair sequence and incident
record. `scripts/claude-signin-io.mjs` owns the Claude/native browser, Keychain and
fixed HTTPS boundaries. `scripts/harness-signin.mjs` connects the installed account,
durable record and existing custody; `instar2 signin` is its owner surface. The pool
reads the same record, and a credential's receipt binding detects a lost completion
record. State and browser profiles are deliberately machine-local; credentials are
never transferred to peers. The native browser/Keychain transport in this slice is
macOS-only and assisted. It does not claim unattended or phone-complete sign-in.
