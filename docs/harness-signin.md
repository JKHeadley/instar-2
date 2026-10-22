# Repairing an installed Claude login

On an installation using the existing Instar 1.x subscription service, the agent
starts the command below and the operator taps **Repair sign-in** in that service's
**Subscriptions** account × machine cell from their phone. Its existing dashboard
unlock and one-use repair approval remain in charge. An already-authorized
unattended policy still runs without another approval. The adapter never approves
as the operator, changes that policy, or starts a competing browser.

The installation owner binds that service in the login's `harness-logins.json` row:

```json
{
  "signinService": {
    "account": "owner@example.com",
    "accountId": "installed-account-id",
    "machineId": "installed-local-machine-id",
    "profileId": "installed-browser-profile-id",
    "url": "http://127.0.0.1:4042/",
    "dashboardUrl": "https://operator.example.com/dashboard#subscriptions",
    "tokenFile": "/absolute/private/service-api-token"
  }
}
```

These are installation values, not fields the phone user fills in. The token file
contains the existing service API bearer, is owned by the installation user and
has mode 0600. It is never an operator PIN or approval session. The profile's
`configDirectory` must name the same private native config home as that service's
account. The normal `signinBrowser` binding still identifies its dedicated browser.
Installation updates retain both bindings. This adapter requires an existing 1.x
service with its phone surface and repair machinery installed; it does not create
or configure that service.

The command waits up to ten minutes for that exact repair and continues after the
phone approval. It only reads the service. A changed account, config home, browser
profile, incident or input digest remains held. An unavailable or observe-only
service never falls back to a second local browser. Existing active incidents may
be observed; an old completed incident cannot stand for a new failure. After a
timeout the agent can invoke the same command to observe the retained episode.
The service's completion still requires the independent provider identity and
authenticated-use checks below before the replacement reaches 2.0 custody.

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

Without a service binding, the original assisted command opens normal Chrome with that account's profile. Complete the provider's
offered controls there. No password, token or code is printed or requested in the
terminal. The native CLI runs `auth login` with a separate private `CLAUDE_CONFIG_DIR` and
stores its credential in that config directory's own macOS Keychain slot. It retains
the OS user's `HOME` so macOS can resolve the login Keychain; replacing `HOME` with
an empty directory prevents the native CLI from saving the login. Chrome opens in the background at a blank
page; a PID-bound Apple Event navigates that blank page, receiving the authorization
URL over stdin rather than a process argument. A bounded read-only wait lets
Chrome replace a stale lock and create its first scriptable blank tab; a different
process or occupied tab refuses, and uncertain navigation is never retried. The profile must already permit
JavaScript from Apple Events. On the expected account's Claude Code authorization
page, Instar sends the measured anti-misclick guard's window-focus event in the page's
main world, waits two seconds, rechecks the account and OAuth state, and clicks the
enabled **Authorize** button once. It does not move OS focus or change the button's
disabled state. On the provider's authentication-code callback page, the code is
read only from the offered code element, checked against this CLI's OAuth state,
and passed once through the waiting CLI's stdin. The code stays in memory. A
missing paste prompt, changed callback, stop or failed pipe prevents completion.
A different identity or state, blocked script injection, a stopped
repair or a still-disabled button prevents the click. Google sign-in and provider
challenges remain in the existing browser flow. A local stale Chrome lock is left
for Chrome to recover only after its
exact PID is confirmed absent; a live or unidentifiable owner is refused.
Completion, stop and failure close the dedicated browser launched by this attempt.
Cleanup rechecks the exact PID and profile before termination, waits a bounded
grace period, and escalates only against that same rechecked process. An existing
browser is never adopted or closed; uncertain cleanup leaves the repair unfinished.

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
the CLI and prevents publication. Process termination targets only the CLI and dedicated browser it
started. An interrupted browser step is re-observed before any publication, never
blindly started again. A normal unsuccessful attempt can be re-entered to verify a
credential that arrived late. A process crash leaves its account/browser locks
visible: the installation owner must establish that the original processes ended
before releasing those locks. There is no automatic stale-lock takeover or blind
sign-in retry. Wrong-identity refusals remain held.

`scripts/claude-signin-repair.mjs` ports the small 1.x repair sequence and incident
record. `scripts/claude-signin-io.mjs` owns the Claude/native browser, Keychain and
fixed HTTPS boundaries. `scripts/claude-signin-code.mjs` owns the bounded, state-bound callback read.
`scripts/claude-signin-authorize.mjs` owns the narrow
account/state-bound consent step, with bounded read-only polling while the CLI is
alive and no retry of an uncertain click. `scripts/harness-signin.mjs` connects the
installed account,
durable record and existing custody; `instar2 signin` is its owner surface. The pool
reads the same record. `scripts/claude-signin-service.mjs` adapts the 1.x
SubscriptionReloginService approval/unattended policy and its existing dashboard
repair-cell route without acquiring approval authority. A credential's receipt binding detects a lost completion
record. State and browser profiles are deliberately machine-local; credentials are
never transferred to peers. The native browser/Keychain transport in this slice is
macOS-only. The unbound assisted command still requires browser interaction on the
Mac; only the installed-service path uses the existing phone approval surface.
The native path has completed a fresh scratch login as the permitted real account,
including the focus guard, code handoff, provider identity check, authenticated
quota call and one bounded real inference. Scratch custody was then deleted and
the original login independently remained valid. The phone-service adapter still
requires a separate live approval proof on a scratch-bound service; the existing
live service maps the account to its serving config. Native completion does not
establish phone-path completion.
