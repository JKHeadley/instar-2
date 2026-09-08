| Profile | Cut after | then after | Boots | Cuts that fired | External applications | Six operations | Terminal disposition |
|---|---|---|---|---|---|---|---|
| full | `preservation` | `authentication` | 3 | preservation, authentication | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `authentication` | `standing` | 3 | authentication, standing | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `standing` | `run-creation` | 3 | standing, run-creation | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `run-creation` | `grounding` | 3 | run-creation, grounding | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `grounding` | `judgment-request` | 3 | grounding, judgment-request | 0 | none | no settlement; owned-pending-no-answer |
| full | `judgment-request` | `judgment-reservation` | 2 | judgment-request | 0 | none | no settlement; owned-pending-no-answer |
| full | `judgment-reservation` | `judgment-claim` | 2 | judgment-reservation | 0 | model-judgment:closed/resolved | no settlement; owned-unresolved-model, owned-pending-no-answer |
| full | `judgment-claim` | `judgment-dispatch` | 2 | judgment-claim | 0 | model-judgment:dispatch-claimed | no settlement; owned-unresolved-model, owned-pending-no-answer, owned-pending-unresolvable |
| full | `judgment-dispatch` | `model-invocation` | 2 | judgment-dispatch | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-no-answer, owned-pending-unresolvable |
| full | `model-invocation` | `judgment-resolution` | 2 | model-invocation | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-no-answer, owned-pending-unresolvable |
| full | `judgment-resolution` | `outbound-preparation` | 3 | judgment-resolution, outbound-preparation | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `outbound-preparation` | `rebuild:minimal.intake-ledger` | 3 | outbound-preparation, rebuild:minimal.intake-ledger | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `rebuild:minimal.intake-ledger` | `rebuild:minimal.principal-binding` | 3 | rebuild:minimal.intake-ledger, rebuild:minimal.principal-binding | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `rebuild:minimal.principal-binding` | `rebuild:minimal.run-view` | 3 | rebuild:minimal.principal-binding, rebuild:minimal.run-view | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `rebuild:minimal.run-view` | `rebuild:minimal.outbound-obligation` | 3 | rebuild:minimal.run-view, rebuild:minimal.outbound-obligation | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `rebuild:minimal.outbound-obligation` | `rebuild:minimal.authority-queue` | 3 | rebuild:minimal.outbound-obligation, rebuild:minimal.authority-queue | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| full | `rebuild:minimal.authority-queue` | `rebuild:minimal.guard-repair` | 3 | rebuild:minimal.authority-queue, rebuild:minimal.guard-repair | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unresolvable, owned-pending-unadmitted |
| reply | `preservation` | `authentication` | 3 | preservation, authentication | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `authentication` | `standing` | 3 | authentication, standing | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `standing` | `run-creation` | 3 | standing, run-creation | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `run-creation` | `grounding` | 3 | run-creation, grounding | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `grounding` | `outbound-preparation` | 3 | grounding, outbound-preparation | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `outbound-preparation` | `outbound-reservation` | 3 | outbound-preparation, outbound-reservation | 0 | outbound-reply:closed/resolved | no settlement |
| reply | `outbound-reservation` | `outbound-claim` | 2 | outbound-reservation | 0 | outbound-reply:closed/resolved | no settlement |
| reply | `outbound-claim` | `outbound-consume` | 2 | outbound-claim | 0 | outbound-reply:dispatch-claimed | settled did-not-happen |
| reply | `outbound-consume` | `external-send` | 2 | outbound-consume | 0 | outbound-reply:consumed | settled did-not-happen |
| reply | `external-send` | `delivery-evidence` | 3 | external-send, delivery-evidence | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `delivery-evidence` | `settlement` | 3 | delivery-evidence, settlement | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `settlement` | `settlement-application` | 3 | settlement, settlement-application | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `settlement-application` | `rebuild:minimal.intake-ledger` | 3 | settlement-application, rebuild:minimal.intake-ledger | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `rebuild:minimal.intake-ledger` | `rebuild:minimal.principal-binding` | 3 | rebuild:minimal.intake-ledger, rebuild:minimal.principal-binding | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `rebuild:minimal.principal-binding` | `rebuild:minimal.run-view` | 3 | rebuild:minimal.principal-binding, rebuild:minimal.run-view | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `rebuild:minimal.run-view` | `rebuild:minimal.outbound-obligation` | 3 | rebuild:minimal.run-view, rebuild:minimal.outbound-obligation | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `rebuild:minimal.outbound-obligation` | `rebuild:minimal.authority-queue` | 3 | rebuild:minimal.outbound-obligation, rebuild:minimal.authority-queue | 1 | outbound-reply:consumed/resolved | settled happened |
| reply | `rebuild:minimal.authority-queue` | `rebuild:minimal.guard-repair` | 3 | rebuild:minimal.authority-queue, rebuild:minimal.guard-repair | 1 | outbound-reply:consumed/resolved | settled happened |
| judgment | `preservation` | `authentication` | 3 | preservation, authentication | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `authentication` | `standing` | 3 | authentication, standing | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `standing` | `run-creation` | 3 | standing, run-creation | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `run-creation` | `grounding` | 3 | run-creation, grounding | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `grounding` | `judgment-request` | 3 | grounding, judgment-request | 0 | none | no settlement; owned-pending-no-answer |
| judgment | `judgment-request` | `judgment-reservation` | 2 | judgment-request | 0 | none | no settlement; owned-pending-no-answer |
| judgment | `judgment-reservation` | `judgment-claim` | 2 | judgment-reservation | 0 | model-judgment:prepared | no settlement; owned-unresolved-model, owned-pending-no-answer |
| judgment | `judgment-claim` | `judgment-dispatch` | 2 | judgment-claim | 0 | model-judgment:dispatch-claimed | no settlement; owned-unresolved-model, owned-pending-no-answer |
| judgment | `judgment-dispatch` | `model-invocation` | 2 | judgment-dispatch | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-no-answer |
| judgment | `model-invocation` | `judgment-resolution` | 2 | model-invocation | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-no-answer |
| judgment | `judgment-resolution` | `outbound-preparation` | 3 | judgment-resolution, outbound-preparation | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `outbound-preparation` | `rebuild:minimal.intake-ledger` | 3 | outbound-preparation, rebuild:minimal.intake-ledger | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `rebuild:minimal.intake-ledger` | `rebuild:minimal.principal-binding` | 3 | rebuild:minimal.intake-ledger, rebuild:minimal.principal-binding | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `rebuild:minimal.principal-binding` | `rebuild:minimal.run-view` | 3 | rebuild:minimal.principal-binding, rebuild:minimal.run-view | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `rebuild:minimal.run-view` | `rebuild:minimal.outbound-obligation` | 3 | rebuild:minimal.run-view, rebuild:minimal.outbound-obligation | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `rebuild:minimal.outbound-obligation` | `rebuild:minimal.authority-queue` | 3 | rebuild:minimal.outbound-obligation, rebuild:minimal.authority-queue | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| judgment | `rebuild:minimal.authority-queue` | `rebuild:minimal.guard-repair` | 3 | rebuild:minimal.authority-queue, rebuild:minimal.guard-repair | 0 | model-judgment:consumed | no settlement; owned-unresolved-model, owned-pending-unadmitted |
| full | `judgment-reservation` | `operation-close` | 3 | judgment-reservation, operation-close | 0 | model-judgment:closed/resolved | no settlement; owned-unresolved-model, owned-pending-no-answer |
| reply | `outbound-reservation` | `operation-close` | 3 | outbound-reservation, operation-close | 0 | outbound-reply:closed/resolved | no settlement |
