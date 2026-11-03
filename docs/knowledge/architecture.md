# Architecture

How the system is put together: its parts, how they talk to each other, where data lives, and the boundaries between them.

<!-- Drafted by the Dexys Factory Blueprint. Merging confirms what's here: agents then follow it. Edit anything that's wrong; an edited item becomes Authoritative. Answer a Question by writing the answer in its text. To confirm an Assumption or an Uncertain item as it is, change its marker to kind=fact or status=existing. -->

<!-- dexys id=static-spa status=existing kind=fact draft=4d0a9bf10f1c -->
## A static single-page app with no backend

`index.html` loads `src/main.ts`, which imports `src/style.css` and calls `mount()` on `#app`. `npm run build` writes static files to `dist/`, which `.gitignore` excludes. The repository has no server, API calls or backend.

<!-- dexys id=single-module status=existing kind=fact draft=085c0aeceae4 -->
## All logic and UI live in one module, `src/app.ts`

`src/app.ts` holds the pure math (`calculate`, `calculateFunction`, `formatNumber`, `formatEntry`, `formatFunctionEntry`) and also `mount()`. `mount()` renders the markup from an HTML string (`KEYPAD_HTML`) and wires every event. It's kept apart from `src/main.ts` so tests can mount it into a jsdom document.

<!-- dexys id=result-type status=existing kind=fact draft=1c73404ccf29 -->
## Math errors come back as values, not exceptions

The pure functions return `CalcResult` (`{ ok: true, value } | { ok: false, error }`). They never throw, and they turn NaN and Infinity into error messages. `mount()` shows `error` in the display through `fail()` and adds history entries only for `ok` results (`src/app.ts`).

<!-- dexys id=closure-state status=existing kind=fact draft=602c10c98bea -->
## Calculator state is local variables inside `mount()`

All state lives in closure variables inside `mount()`: `entry`, `error`, `accumulator`, `pendingOp`, `awaitingOperand`, `startNew` and `memory`. Each action goes through `pressKey(name)`, and then `update()` re-syncs the DOM. There's no framework and no state store, and history exists only as `<li>` elements in the DOM (`src/app.ts`).

<!-- dexys id=input-routing status=existing kind=fact draft=8af59a217890 -->
## Clicks and keyboard both go through `pressKey`

Each keypad button has a `data-key` name. One delegated click listener on `.keypad` dispatches through `pressKey`. A `document` keydown listener maps keys to the same names: digits, `+ - * /`, Enter/`=`, Escape→`clearAll`, Backspace and `%`. It ignores modified keys and keys aimed outside the app (`src/app.ts`).

<!-- dexys id=no-persistence status=existing kind=fact draft=84446672f818 -->
## Nothing is stored between page loads

Memory and history are lost on reload. A search of `src/` finds no `localStorage`, `sessionStorage`, IndexedDB, cookies or `fetch`.

<!-- dexys id=dead-parse-operand status=uncertain kind=question draft=9e68975c1938 -->
## Should the unused `parseOperand` be removed or kept?

`parseOperand` in `src/app.ts` is exported and tested in `tests/app.test.ts`, but nothing in `src/` calls it. `tests/keypad.test.ts` checks that 'the form is gone' (no Operation dropdown, number fields or Calculate button). It looks like a leftover from an earlier form-based version.

<!-- dexys id=deploy-target status=uncertain kind=question draft=d4fc5ef9d8d3 -->
## Where and how is the built `dist/` deployed?

`npm run build` produces static files in `dist/`, but the repository has no hosting config, deploy script or CI. Agents can't tell how a change reaches users.
