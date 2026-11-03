# Stack

Languages, frameworks, libraries and tools, with versions where they matter, and how to build, run and test it.

<!-- Drafted by the Dexys Factory Blueprint. Merging confirms what's here: agents then follow it. Edit anything that's wrong; an edited item becomes Authoritative. Answer a Question by writing the answer in its text. To confirm an Assumption or an Uncertain item as it is, change its marker to kind=fact or status=existing. -->

<!-- dexys id=typescript status=existing kind=fact draft=b648dc2328c5 -->
## Strict TypeScript 7.0.2 with no emit

`tsconfig.json` sets strict mode, target ES2022, lib ES2022 + DOM + DOM.Iterable, `moduleResolution: bundler`, `noEmit` and `types: ["vite/client"]`. It covers `src`, `tests` and `vite.config.ts`. The package is ESM (`"type": "module"` in `package.json`).

<!-- dexys id=vite-vitest status=existing kind=fact draft=f6a5c2681368 -->
## Vite 8 for dev and build, Vitest 5 with jsdom for tests

`package.json` pins its devDependencies to exact versions: `vite` 8.3.4, `vitest` 5.0.4, `jsdom` 30.1.2 and `typescript` 7.0.2. There are no runtime dependencies, and the UI is plain DOM code. `package-lock.json` is committed.

<!-- dexys id=scripts status=existing kind=fact draft=d9b65469d49e -->
## Build, run and test with three npm scripts

`npm run dev` starts the Vite dev server. `npm test` runs `vitest run`. `npm run build` runs `tsc --noEmit && vite build`, so type errors fail the build (`package.json`, `README.md`).

<!-- dexys id=vite-config status=existing kind=fact draft=1287a43d02e9 -->
## One config file serves both Vite and Vitest

`vite.config.ts` imports `defineConfig` from `vitest/config` and sets only the test environment (`jsdom`) and the include glob (`tests/**/*.test.ts`). It has no plugins and no build options.

<!-- dexys id=no-lint status=existing kind=fact draft=6c551c0ff9c7 -->
## No linter or formatter is configured

The repository has no ESLint, Prettier or other formatter config, and `package.json` has no `lint` script. Type checking happens only in `npm run build`, not in `npm test`.

## Which Node.js version should be used?

26v
