# Architecture

How the system is put together: its parts, how they talk to each other, where data lives, and the boundaries between them.

<!-- Drafted by the Dexys Factory Blueprint. Merging confirms what's here: agents then follow it. Edit anything that's wrong; an edited item becomes Authoritative. Answer a Question by writing the answer in its text. To confirm an Assumption or an Uncertain item as it is, change its marker to kind=fact or status=existing. -->

<!-- dexys id=static-spa status=existing kind=fact draft=353da07d9980 -->
## A static single-page app with no backend

Since `.gitignore` excludes it, nothing is committed under `dist/`. `npm run build` builds the static files into that folder. `index.html` loads `src/main.ts`, which imports `src/style.css` and calls `mount()` on `#app`. No server, API calls or backend exist in the repository.

<!-- dexys id=single-module status=existing kind=fact draft=cfad5a4fc9f9 -->
## All logic and UI live in one module, `src/app.ts`

`src/app.ts` holds the pure math (`calculate`, `calculateFunction`, `formatNumber`, `formatEntry`, `formatFunctionEntry`) and also `mount()`. `mount()` renders the markup as an HTML string and wires every event. It's kept apart from `src/main.ts` so tests can mount into a jsdom document.

<!-- dexys id=result-type status=existing kind=fact draft=568ad68aee90 -->
## Math errors come back as values, not exceptions

Each pure function returns `CalcResult` (`{ ok: true, value } | { ok: false, error }`). They never throw and never return NaN or Infinity. `mount()` shows `error` in the display through `fail()` and adds history entries only for `ok` results (`src/app.ts`).

<!-- dexys id=closure-state status=existing kind=fact draft=fced555b6651 -->
## Calculator state is local variables inside `mount()`

Closure variables inside `mount()` hold all the state: `entry`, `error`, `accumulator`, `pendingOp`, `awaitingOperand`, `startNew` and `memory`. Each action goes through `pressKey(name)` and then `update()` re-syncs the DOM. The code has no framework and no state store. History exists only as `<li>` elements in the DOM (`src/app.ts`).

<!-- dexys id=input-routing status=existing kind=fact draft=6cef463a4488 -->
## Clicks and keyboard both go through `pressKey`

Each keypad button has a `data-key` name. A single delegated click listener on `.keypad` dispatches through `pressKey`. A `document` keydown listener maps keys to the same names: digits, `+ - * /`, Enter/`=`, Escape→`clearAll`, Backspace and `%` (`src/app.ts`).

<!-- dexys id=no-persistence status=existing kind=fact draft=d5607c447174 -->
## Nothing is stored between page loads

Memory and history are lost on reload because nothing uses `localStorage`, cookies or a server. A search for storage APIs found nothing in `src/`.

<!-- dexys id=dead-parse-operand status=uncertain kind=question draft=c0b3d56a44b0 -->
## Should the unused `parseOperand` be removed or kept?

`parseOperand` in `src/app.ts` is exported and tested in `tests/app.test.ts`, but nothing in `src/` calls it. `tests/keypad.test.ts` checks that 'the form is gone' (no Operation dropdown, number fields or Calculate button). So it looks like a leftover from an earlier form-based version.
