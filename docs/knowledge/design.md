# Design

How the product looks and behaves for people: screens, flows, the visual language and conventions in the UI and the API.

<!-- Drafted by the Dexys Factory Blueprint. Merging confirms what's here: agents then follow it. Edit anything that's wrong; an edited item becomes Authoritative. Answer a Question by writing the answer in its text. To confirm an Assumption or an Uncertain item as it is, change its marker to kind=fact or status=existing. -->

<!-- dexys id=iphone-look status=existing kind=fact draft=718d4a09351b -->
## The visual model is the iPhone Calculator dark theme

`src/style.css` uses a black page, white text and the `-apple-system`/SF Pro font stack. Keys are pill-shaped (`border-radius: 999px`). Digits are dark grey `#333`, operators and `=` are orange `#ff9f0a`, AC/±/% are light grey `#a5a5a5` with black text, and scientific and memory keys are darker grey `#1c1c1c`. Comments in `src/app.ts` and `src/style.css` name the iPhone landscape layout as the model.

<!-- dexys id=layout status=existing kind=fact draft=8e54ef33e3c4 -->
## Landscape layout side by side, stacked below 600px

`.keypad` is a flex row holding a 3-column scientific and memory grid (`.keys-sci`) to the left of the 4-column main grid (`.keys-main`), where `0` spans two columns. Under `@media (max-width: 599px)` the layout stacks, with the scientific keys in a 4-column strip above round square keys (`src/style.css`).

<!-- dexys id=calc-flow status=existing kind=fact draft=8090e1d726b8 -->
## Calculations run immediately and left to right

A binary operator waits for a second number and is highlighted (`is-active`, white with orange text, `aria-pressed=true`). Pressing a second operator works out the pending result first, so `2 + 3 × 4 =` gives 20 because there's no operator precedence. √, sin, cos, tan, log and ln act on the displayed number straight away, with angles in degrees. `%` divides the display by 100 (`src/app.ts`).

<!-- dexys id=clear-key status=existing kind=fact draft=1eb93eeb7500 -->
## The clear key switches between C and AC

The clear key reads `C` and clears only the current entry while the display isn't 0. Once the display is 0 it reads `AC` and clears everything, including a pending operation. Escape on the keyboard always does a full clear (`clearAll` in `src/app.ts`).

<!-- dexys id=errors status=existing kind=fact draft=9934b6d021a5 -->
## Errors appear in the display as plain-language messages

Errors such as 'Cannot divide by zero' or 'Result is too large to show' replace the number in the display, which gets a smaller `.is-error` font. While an error shows, operators, m+ and m− are blocked (m+ and m− are disabled), and the next digit starts a new entry. Errors never add a history entry (`src/app.ts`, `src/style.css`).

<!-- dexys id=history-memory status=existing kind=fact draft=28cd314ec2c4 -->
## A History panel and memory with an indicator

The `History` toggle shows and hides a panel that starts hidden. Entries such as `6 × 3 = 18` or `√16 = 4` are added newest first, each with a 'Store in memory' button. An `M: value` indicator shows memory and hides while memory is 0. Results are rounded to 12 significant digits by `formatNumber` (`src/app.ts`).

<!-- dexys id=a11y status=existing kind=fact draft=2e747d74826d -->
## Accessibility relies on ARIA labels and a live region

Buttons have `aria-label`s, the display is an `<output aria-live="polite">`, the history toggle sets `aria-expanded`, and focus rings use `:focus-visible`. A mousedown handler stops buttons taking focus on click, so Enter keeps meaning `=` (`src/app.ts`, `src/style.css`).

<!-- dexys id=keyboard-gaps status=uncertain kind=question draft=066eaa253e4f -->
## Should scientific keys get keyboard shortcuts, and should a repeated = repeat the last operation?

`pressKey` in `src/app.ts` handles power, root and the scientific and memory functions, but the keydown handler maps only digits, `+ - * /`, Enter/`=`, Escape, Backspace and `%`. Pressing `=` with no pending operation doesn't repeat the last operation, while the iPhone it imitates does.
