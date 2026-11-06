# Codex model-map receipt carries its subsidy review time

After build 79be7e88 went live, mechanical merges of trains 180, 189, 192 and 194 refused on `src/assembly/production-codex-provider.declarations.json`. The planner needs one input whose receipt binds both observation stamps. The 2026-11-05 receipt recorded a subsidy review without its time, and the planner refuses to infer one.

Echo, the map maintainer, repeated the read and the review on 2026-11-06. The Mama PC was unreachable, so the catalog came from the Mac Studio's Codex CLI cache, fetched at 2026-11-06T21:59:24.081853Z and listing `gpt-5.6-sol`. `codex login status` reports `Logged in using ChatGPT`. The subsidy estimate stays ratio 1, basis estimated, and its review time, 1794002370050, is the clock at that review. Both freshness windows are unchanged.

`docs/release-evidence/codex-model-map-refresh-1105.json` is updated in place because the planner accepts only that path and the train-187 receipt; the earlier receipt stays in history at commit 4c562e19d. This is catalog membership and an estimate, not generation, quota or billing proof, and it does not certify another machine's login.
