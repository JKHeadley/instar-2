# Instar 2.0 core package

`index.ts` is the package root. It re-exports Part One's values, decoders and canonical encoding, which every other module builds on. Each subdirectory is one module with its own README; the build input is `tsconfig.build.json` and the public entry points are the `exports` in `package.json`.
