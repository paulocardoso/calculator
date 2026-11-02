# Quality

How quality is checked today: the kinds of tests, where they live, what they cover, and what isn't covered.

<!-- Drafted by the Dexys Factory Blueprint. Merging confirms what's here: agents then follow it. Edit anything that's wrong; an edited item becomes Authoritative. Answer a Question by writing the answer in its text. To confirm an Assumption or an Uncertain item as it is, change its marker to kind=fact or status=existing. -->

<!-- dexys id=vitest-jsdom status=existing kind=fact draft=ee1845f5f681 -->
## All tests are Vitest tests in `tests/`, run with `npm test`

`vite.config.ts` includes `tests/**/*.test.ts` and runs them in jsdom. `tests/app.test.ts` unit-tests the pure functions in `src/app.ts`. The other test files mount the app and use it like a user would.

<!-- dexys id=user-level-helpers status=existing kind=fact draft=0ece7b46d548 -->
## Acceptance tests drive the UI by visible labels through shared helpers

`tests/keypad-helpers.ts` finds keys by visible text, `aria-label` or `title` (never by id, class or test id). It finds the display as the element showing `0` and checks history and the memory indicator through visible text. It also tracks global listeners and removes them between tests. If you change labels, check its `KEY_PATTERNS`.

<!-- dexys id=behaviour-coverage status=existing kind=fact draft=a449ec3737da -->
## The behaviour tests cover each feature area

Behaviour is covered by these test files: `calculator`, `keypad`, `keyboard`, `functions`, `scientific`, `percent`, `memory` and `history`. Between them they test arithmetic, decimals and signs, error messages, degrees for trig functions, power and root, percent, memory keys and the indicator, history order and 'Store in memory', keyboard shortcuts and ignored modifiers, and the absence of editable fields.

<!-- dexys id=theme-tests status=existing kind=fact draft=a70e16620cf9 -->
## Visual style is checked in jsdom through computed styles

`tests/theme.test.ts` loads every `.css` file under `src/` and `public/` into jsdom. It unwraps `@media` rules as if the screen were 1024×768 and resolves `var()`. It then checks colours, the font stack, rounded keys, the grid layout, the pending-operator highlight and the C/AC label through `getComputedStyle`.

<!-- dexys id=untested-layout status=existing kind=fact draft=2a3e1395c11b -->
## The portrait layout and real-browser rendering are not tested

The theme tests only consider a 1024×768 landscape screen, so the `max-width: 599px` portrait layout in `src/style.css` is never checked. No real-browser, visual-regression or end-to-end tests exist, and jsdom doesn't do real layout.

<!-- dexys id=no-ci status=existing kind=fact draft=1c09087c8011 -->
## No CI runs the tests or the type check

The repository has no `.github/workflows` or other CI files. `npm test` doesn't type-check; only `npm run build` runs `tsc --noEmit`.

<!-- dexys id=merge-gate status=uncertain kind=question draft=c5eb3d6278bd -->
## What must pass before a change is merged?

Nothing in the repository says whether `npm run build` and `npm test` must pass before a merge, or whether anything checks coverage. Since nothing type-checks automatically, type errors in `tests/` could go unnoticed until someone builds.
