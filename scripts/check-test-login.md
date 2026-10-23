# Test login preflight

`check-test-login.mjs` enforces an operator-supplied reserved-account policy before
a copy, proof room or answer check starts. It reads non-secret profile metadata;
it does not read credentials, contact a provider, alter admission records or grant
access. The ordinary activation, custody, quota, stop and delivery checks still run.

```sh
node scripts/check-test-login.mjs --policy /absolute/test-login-policy.json -- \
  --root /absolute/test-root --login-profile /absolute/test-profile.json
```

The policy has `version: 1` and a nonempty `reserved` array. Each entry has an
`account` (the profile's `expectedAccount`), `usageAccounts` (pool account IDs), and
a plain `reason` naming the operator's restriction. No credential belongs in it.

An explicit profile is checked directly. An explicit `--login-pool` checks every
member, including held or unavailable fallbacks. With neither flag, the root's
installed `harness-logins.json` is checked. `--inventory /absolute/file.json` also
checks an inventory that a launcher intends to copy. Retained admitted profiles
are checked alongside current profiles so a rename or stale snapshot cannot hide
a reserved account. Missing or malformed metadata refuses with exit 2. Success
is silent and exits 0; it means only that the reserved-account check passed.

The deploying desk owns the policy and invokes this preflight before any pause,
copy or launch, then checks the actual launch again. Tests cover allowed and
reserved neighbors, fallback members, retained profiles, and unreadable input.
The policy and deployment records are machine-local operator configuration; they
are not a new provider, model selector or polling service. Rules 4, 15, 35, 42,
49, 103, 113 and 116 govern this boundary.
