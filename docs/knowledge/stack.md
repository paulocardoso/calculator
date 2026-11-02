# Stack

Languages, frameworks, libraries and tools, with versions where they matter, and how to build, run and test it.

<!-- Drafted by the Dexys Factory Blueprint. Merging confirms what's here: agents then follow it. Edit anything that's wrong; an edited item becomes Authoritative. Answer a Question by writing the answer in its text. To confirm an Assumption or an Uncertain item as it is, change its marker to kind=fact or status=existing. -->

<!-- dexys id=typescript status=existing kind=fact draft=63d763ab0441 -->
## Strict TypeScript 7.0.2 with no emit

`tsconfig.json` sets strict mode, target and lib ES2022 plus DOM, `moduleResolution: bundler` and `noEmit`. It covers `src`, `tests` and `vite.config.ts`. The package is ESM (`"type": "module"` in `package.json`).

<!-- dexys id=vite-vitest status=existing kind=fact draft=3b1a2e8e2853 -->
## Vite 8 for dev and build, Vitest 5 with jsdom for tests

The devDependencies in `package.json` are pinned to exact versions: `vite` 8.3.4, `vitest` 5.0.4, `jsdom` 30.1.2 and `typescript` 7.0.2. There are no runtime dependencies, and the UI is plain DOM code. `package-lock.json` is committed.

<!-- dexys id=scripts status=existing kind=fact draft=d9b65469d49e -->
## Build, run and test with three npm scripts

`npm run dev` starts the Vite dev server. `npm test` runs `vitest run`. `npm run build` runs `tsc --noEmit && vite build`, so type errors fail the build (`package.json`, `README.md`).

<!-- dexys id=vite-config status=existing kind=fact draft=be02c2ff21cd -->
## One config file serves both Vite and Vitest

`vite.config.ts` uses `vitest/config` and sets only the test environment (`jsdom`) and the include glob (`tests/**/*.test.ts`). It adds no plugins and no build settings.

<!-- dexys id=no-lint status=existing kind=fact draft=4e4cab2ad45f -->
## No linter or formatter is configured

No ESLint, Prettier or other formatter config exists, and no `lint` script is defined in `package.json`. Type checking happens only inside `npm run build`, not inside `npm test`.

<!-- dexys id=node-version status=uncertain kind=question draft=d0cfa50a6596 -->
## Which Node.js version should be used?

The README says the project was 'Started by Dark Factory from the web template'. The repository doesn't say which Node.js version is supported: no `engines` field, `.nvmrc` or CI config.
