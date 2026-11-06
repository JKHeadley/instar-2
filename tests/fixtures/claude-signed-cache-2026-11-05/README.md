# Signed policy cache capture

Exact public signed-cache metadata captured read-only on 2026-11-05 from
`/Users/Shared/instar-harness/profile/preview-harness-profile-sagemind-justin-v1/config/policy-limits.json.signature.json`.
It is a signature over policy metadata, not a login credential or bearer grant.
The failed train-175 answer copy retained update 840344298 with zero model calls;
its provider profile inspection refused this file as unknown before dispatch.

The installed Claude Code 2.1.280 signed-cache helper writes `{jws, receivedAt}`
and a separate accepted-issuance record `{typ, aud?, sub?, ws?, iat}`. The latter
neighbor is constructed in the test from that observed code schema. Signature
verification remains the CLI's responsibility; Instar checks the effective
policy independently and never treats this signature as its own authority.
31af3942d376da58080a3f11d9c43e79312b7aa99a70e0edc20d203511c41d3d  tests/fixtures/claude-signed-cache-2026-11-05/policy-limits.json.signature.json
