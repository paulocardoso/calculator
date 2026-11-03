# Quality

How quality is checked today: the kinds of tests, where they live, what they cover, and what isn't covered.

<!-- Drafted by the Dexys Factory Blueprint. Merging confirms what's here: agents then follow it. Edit anything that's wrong; an edited item becomes Authoritative. Answer a Question by writing the answer in its text. To confirm an Assumption or an Uncertain item as it is, change its marker to kind=fact or status=existing. -->

<!-- dexys id=vitest-jsdom status=existing kind=fact draft=da0d60daa857 -->
## All tests are Vitest tests in `tests/`, run with `npm test`

`vite.config.ts` includes `tests/**/*.test.ts` and runs them in jsdom. `tests/app.test.ts` unit-tests the pure functions in `src/app.ts`. The other test files mount the app and use it the way a user would.

<!-- dexys id=user-level-helpers status=existing kind=fact draft=e840395cb355 -->
## Acceptance tests drive the UI by visible labels through shared helpers

`tests/keypad-helpers.ts` finds keys by visible text, `aria-label` or `title`, never by id, class or test id. It finds the display as the element showing `0` and reads history and the memory indicator from visible text. It also tracks global listeners and removes them between tests. If you change labels, check its `KEY_PATTERNS`.

<!-- dexys id=behaviour-coverage status=existing kind=fact draft=c83ccf7ad3d4 -->
## The behaviour tests cover each feature area

Behaviour is covered by `calculator`, `keypad`, `keyboard`, `functions`, `scientific`, `percent`, `memory` and `history` in `tests/`. Together they test arithmetic, decimals and signs, error messages (never Infinity or NaN), trig in degrees, power and root, percent, memory keys and the indicator, history order and 'Store in memory', keyboard shortcuts with modifiers ignored, and the absence of editable fields.

<!-- dexys id=theme-tests status=existing kind=fact draft=5857c96149c9 -->
## Visual style is checked in jsdom through computed styles

`tests/theme.test.ts` loads every `.css` file under `src/` and `public/`, plus any `<style>` in `index.html`, into jsdom. It unwraps `@media` rules as if the screen were 1024×768 and resolves `var()`. It then checks colours, the font stack, rounded keys, the grid layout, the pending-operator highlight and the C/AC label through `getComputedStyle`.

<!-- dexys id=thin-unit-tests status=existing kind=fact draft=a2836147a352 -->
## Pure-function unit tests are thin, and coverage isn't measured

`tests/app.test.ts` has only a few cases: render, divide by zero, overflow, `parseOperand`, `formatNumber` and some trig edge cases. Most branches of `calculate` and `nthRoot` are reached only through the UI tests. No coverage tool or threshold is configured (`package.json`, `vite.config.ts`).

<!-- dexys id=untested-layout status=existing kind=fact draft=30640af5a1d4 -->
## The portrait layout and real-browser rendering are not tested

The theme tests only model a 1024×768 landscape screen, so the `max-width: 599px` portrait layout in `src/style.css` is never checked. There are no real-browser, visual-regression or end-to-end tests, and jsdom does no real layout.

<!-- dexys id=no-ci status=existing kind=fact draft=1c09087c8011 -->
## No CI runs the tests or the type check

The repository has no `.github/workflows` or other CI files. `npm test` doesn't type-check; only `npm run build` runs `tsc --noEmit`.

<!-- dexys id=merge-gate status=uncertain kind=question draft=01cbfc523fb1 -->
## What must pass before a change is merged?

Nothing in the repository says whether `npm run build` and `npm test` must pass before a merge. Since nothing type-checks automatically, type errors in `tests/` could go unnoticed until someone builds.
