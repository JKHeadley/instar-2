# Production entry

`instar-production.mjs` is the production launcher: it boots the fixed single-machine installation from an installation record and host module (`scripts/production-boot.mjs`). It is listed in `package.json` `instar.launchers`.

`instar2.mjs` is the installed setup/run/update CLI. Its import closure is also in
the shipped inventory, including update-state and onboarding-state writers.
