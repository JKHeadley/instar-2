# Constrained setup qualification on macOS arm64

**Both configurations failed the unchanged bar. Independent assessment: PENDING ASTRA.**

Each configuration attempted the same 12 cases three times. Prompt, template, captured evidence bytes, expectations, decoder and resource limits were unchanged. The two earlier runs remain preserved separately; no results are averaged.

| Measurement | Constrained 1.5B | Constrained 3B |
|---|---:|---:|
| Completed model responses | 36/36 | 0/36 |
| Schema failures among completed responses | 0/36 | Not measurable |
| Positive neighbors accepted | 12/12 | 0/12 (resource holds) |
| Unsafe model accepts on negatives | 6/24 | Not measurable |
| Negative accepts after exact owner check | 0/24 | 0/24 |
| Resource failures | 0/36 | 36/36 |
| Latency including pin verification | 3.861–10.274 s | 1.299–2.139 s to termination |
| Peak sampled RSS | 1,359,429,632 bytes (1.266 GiB) | 2,348,580,864 bytes (2.187 GiB) before termination |
| Input / output tokens including EOG | 9,153 / 1,899 | Unknown; killed during startup |
| Verified exact-PID cleanup | 36/36 | 36/36 |
| Paid calls / charge | 0 / 0 | 0 / 0 |

The 1.5B model accepted `append-fault` and `conflicting-receipts` in all three repetitions. It mistook rejection of a conflicting append for completion, and treated a receipt naming another installation as matching. Exact owner checks held both cases, but the unchanged bar counts the model's unsafe answers before that protection. All positive neighbors now passed; valid JSON did not fix judgment.

The requested next size was assessed for that remaining judgment failure. Its verified weights loaded, but every launch exceeded the original 2-GiB RSS ceiling. Ten terminated the exact child; no verdict was produced. These measurements do not establish the 3B model's judgment quality or steady-state ordinary-machine fit. Raising the ceiling would be a different configuration and was not done.

Both used `instar-setup-verdict-v1`, passed through b4000's built-in `--json-schema` converter to GBNF. Each trial records its exact schema and SHA-256. The schema requires exactly disposition/reason/evidence, permits both accept and hold, bounds reason length, and requires observed evidence IDs. The unchanged decoder still rejects blank reasons and failed exact owner checks. Neither expected outcomes nor fault labels enter the prompt or schema.

The runtime remains CPU-only llama.cpp b4000, source `c02e5ab2a675c8bc1abc8b1e4cb6a93b26bdcce7`, binary SHA-256 `163f596e37e55871f5b33f2a864f6cb816d14d0519e5f7df11b8ff7d6dfa8dc7`. Reservations remain one child, two threads, 2-GiB sampled RSS ceiling, 4,096 context tokens, 512 output tokens, temperature 0, seed 1, 120-second validation deadline, no retries or paid fallback.

The 1.5B model retains official commit `62a8d092b0a1047016f3edbd0fde387598727aa5`, SHA-256 `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`. The [official 3B file](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/7dabda4d13d513e3e842b20f0d435c732f172cbe/qwen2.5-3b-instruct-q4_k_m.gguf) is pinned at commit `7dabda4d13d513e3e842b20f0d435c732f172cbe`, size 2,104,932,768 bytes, SHA-256 `626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d`. Downloaded bytes were verified before launch and again before every call.

[1.5B evidence](macos-arm64-2026-10-25-constrained-1.5b.json) and [3B evidence](macos-arm64-2026-10-25-constrained-3b.json) retain raw output, diagnostics, Seven request/response/accounting captures, exact executed source snapshots, schema hashes, host and resource measurements. The [prior metered result](macos-arm64-2026-10-25.json) and its preceding raw report stay separate and unchanged.

No docs/14 manifest promotion is supported; docs/14 was not edited. Full isolated preparation/recovery remains uncovered: no separate custodian, independent recovery holder or GE/A0 genesis run. That owner gap is outside this unit. Release signature/library pins, other host profiles and the independent grounded-reason assessment also remain unqualified.

ELI16: formatting is fixed for the small model, but it still approves two kinds of bad evidence. The larger model cannot run inside the current memory limit. Neither can be approved for setup from these results.
