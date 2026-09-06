| Profile | Cut after | then after | Boots | Cuts that fired | External applications | Terminal disposition |
|---|---|---|---|---|---|---|
| reply | `preservation` | `authentication` | 3 | preservation, authentication | 1 | settled happened; owned-pending-unadmitted |
| reply | `authentication` | `standing` | 3 | authentication, standing | 1 | settled happened; owned-pending-unadmitted |
| reply | `standing` | `run-creation` | 3 | standing, run-creation | 1 | settled happened; owned-pending-unadmitted |
| reply | `run-creation` | `outbound-preparation` | 3 | run-creation, outbound-preparation | 1 | settled happened; owned-pending-unadmitted |
| reply | `outbound-preparation` | `outbound-reservation` | 3 | outbound-preparation, outbound-reservation | 0 | no settlement; owned-pending-unadmitted, owned-unapplied-unsettled |
| reply | `outbound-reservation` | `outbound-claim` | 2 | outbound-reservation | 0 | no settlement; owned-pending-unadmitted, owned-unapplied-unsettled |
| reply | `outbound-claim` | `outbound-consume` | 2 | outbound-claim | 0 | settled did-not-happen; owned-pending-unadmitted |
| reply | `outbound-consume` | `external-send` | 2 | outbound-consume | 0 | settled did-not-happen; owned-pending-unadmitted |
| reply | `external-send` | `delivery-evidence` | 3 | external-send, delivery-evidence | 1 | settled happened; owned-pending-unadmitted |
| reply | `delivery-evidence` | `settlement` | 3 | delivery-evidence, settlement | 1 | settled happened; owned-pending-unadmitted |
| reply | `settlement` | `rebuild:minimal.intake-ledger` | 3 | settlement, rebuild:minimal.intake-ledger | 1 | settled happened; owned-pending-unadmitted |
| reply | `rebuild:minimal.intake-ledger` | `rebuild:minimal.principal-binding` | 3 | rebuild:minimal.intake-ledger, rebuild:minimal.principal-binding | 1 | settled happened; owned-pending-unadmitted |
| reply | `rebuild:minimal.principal-binding` | `rebuild:minimal.run-view` | 3 | rebuild:minimal.principal-binding, rebuild:minimal.run-view | 1 | settled happened; owned-pending-unadmitted |
| reply | `rebuild:minimal.run-view` | `rebuild:minimal.outbound-obligation` | 3 | rebuild:minimal.run-view, rebuild:minimal.outbound-obligation | 1 | settled happened; owned-pending-unadmitted |
| reply | `rebuild:minimal.outbound-obligation` | `rebuild:minimal.authority-queue` | 3 | rebuild:minimal.outbound-obligation, rebuild:minimal.authority-queue | 1 | settled happened; owned-pending-unadmitted |
| reply | `rebuild:minimal.authority-queue` | `rebuild:minimal.guard-repair` | 3 | rebuild:minimal.authority-queue, rebuild:minimal.guard-repair | 1 | settled happened; owned-pending-unadmitted |
| judgment | `preservation` | `authentication` | 3 | preservation, authentication | 0 | no settlement; owned-pending-unadmitted |
| judgment | `authentication` | `standing` | 3 | authentication, standing | 0 | no settlement; owned-pending-unadmitted |
| judgment | `standing` | `run-creation` | 3 | standing, run-creation | 0 | no settlement; owned-pending-unadmitted |
| judgment | `run-creation` | `judgment-request` | 3 | run-creation, judgment-request | 0 | no settlement; owned-pending-unadmitted, owned-pending-no-answer |
| judgment | `judgment-request` | `judgment-reservation` | 2 | judgment-request | 0 | no settlement; owned-pending-unadmitted, owned-pending-no-answer |
| judgment | `judgment-reservation` | `judgment-claim` | 2 | judgment-reservation | 0 | no settlement; owned-pending-unadmitted, owned-pending-no-answer |
| judgment | `judgment-claim` | `judgment-dispatch` | 2 | judgment-claim | 0 | no settlement; owned-pending-unadmitted, owned-pending-no-answer |
| judgment | `judgment-dispatch` | `model-invocation` | 2 | judgment-dispatch | 0 | no settlement; owned-pending-unadmitted, owned-pending-no-answer |
| judgment | `model-invocation` | `judgment-resolution` | 2 | model-invocation | 0 | no settlement; owned-pending-unadmitted, owned-pending-no-answer |
| judgment | `judgment-resolution` | `outbound-preparation` | 3 | judgment-resolution, outbound-preparation | 0 | no settlement; owned-pending-unadmitted |
| judgment | `outbound-preparation` | `rebuild:minimal.intake-ledger` | 3 | outbound-preparation, rebuild:minimal.intake-ledger | 0 | no settlement; owned-pending-unadmitted |
| judgment | `rebuild:minimal.intake-ledger` | `rebuild:minimal.principal-binding` | 3 | rebuild:minimal.intake-ledger, rebuild:minimal.principal-binding | 0 | no settlement; owned-pending-unadmitted |
| judgment | `rebuild:minimal.principal-binding` | `rebuild:minimal.run-view` | 3 | rebuild:minimal.principal-binding, rebuild:minimal.run-view | 0 | no settlement; owned-pending-unadmitted |
| judgment | `rebuild:minimal.run-view` | `rebuild:minimal.outbound-obligation` | 3 | rebuild:minimal.run-view, rebuild:minimal.outbound-obligation | 0 | no settlement; owned-pending-unadmitted |
| judgment | `rebuild:minimal.outbound-obligation` | `rebuild:minimal.authority-queue` | 3 | rebuild:minimal.outbound-obligation, rebuild:minimal.authority-queue | 0 | no settlement; owned-pending-unadmitted |
| judgment | `rebuild:minimal.authority-queue` | `rebuild:minimal.guard-repair` | 3 | rebuild:minimal.authority-queue, rebuild:minimal.guard-repair | 0 | no settlement; owned-pending-unadmitted |
