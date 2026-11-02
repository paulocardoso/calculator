import { describe, expect, it } from "vitest";
import {
  calc,
  display,
  editableFields,
  entryPattern,
  expectDisplay,
  expectDisplayError,
  expectEntryAt,
  expectMemory,
  expectNoMemoryIndicator,
  findKey,
  focusOutside,
  historyEntries,
  key,
  press,
  render,
  settle,
  storeControls,
  tap,
  toggleHistory,
  type,
  useApp,
  visibleText,
  type Key,
} from "./keypad-helpers";

// Acceptance tests for the iPhone Calculator-style display and keypad. They
// tap keys found by their labels and read the single display, the memory
// indicator and the History panel the way a user would.

useApp();

describe("keypad", () => {
  it("shows one display starting at 0 and a keypad instead of the form; digits and '.' build the number, AC resets to 0, ± flips the sign and % divides by 100", async () => {
    const root = render();
    expectDisplay(root, "0", "when the app starts");

    // The form is gone.
    expect(root.querySelector("select"), "expected no Operation dropdown").toBeNull();
    expect(editableFields(root), "expected no number fields").toEqual([]);
    expect(
      Array.from(root.querySelectorAll("button")).some((b) => /calculate/i.test(b.textContent ?? "")),
      "expected no Calculate button",
    ).toBe(false);

    const keys: Key[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "AC", "±", "%", "+", "−", "×", "÷", "="];
    for (const k of keys) key(root, k);

    // Digits replace the leading 0 and build the number.
    await tap(root, "7");
    expectDisplay(root, "7", "after 7");
    await tap(root, "AC");
    expectDisplay(root, "0", "after AC");
    await tap(root, "0", "0");
    expectDisplay(root, "0", "after 0 0");
    await tap(root, "7");
    expectDisplay(root, "7", "after 0 0 7");
    await tap(root, "2", "5");
    expectDisplay(root, "725", "after 0 0 7 2 5");
    await tap(root, "AC");

    // At most one decimal point.
    await tap(root, "1", ".");
    expectDisplay(root, "1.", "after 1 .");
    await tap(root, ".");
    expectDisplay(root, "1.", "after 1 . .");
    await tap(root, "5", ".", "2");
    expectDisplay(root, "1.52", "after 1 . . 5 . 2");
    await tap(root, "AC");
    expectDisplay(root, "0", "after AC");
    await tap(root, "0", ".", "0", "5");
    expectDisplay(root, "0.05", "after 0 . 0 5");
    await tap(root, "AC");

    // ± flips the sign.
    await tap(root, "1", "2", "±");
    expectDisplay(root, "-12", "after 12 ±");
    await tap(root, "±");
    expectDisplay(root, "12", "after 12 ± ±");
    await tap(root, "AC", "1.5", "±");
    expectDisplay(root, "-1.5", "after 1.5 ±");
    await tap(root, "AC");
    expectDisplay(root, "0", "AC after a negative number");

    // % divides by 100, without floating point noise.
    await tap(root, "5", "0", "%");
    expectDisplay(root, "0.5", "after 50 %");
    await tap(root, "%");
    expectDisplay(root, "0.005", "after 50 % %");
    const cases: [string, boolean, string][] = [
      ["33", false, "0.33"],
      ["1.1", false, "0.011"],
      ["0.07", false, "0.0007"],
      ["12.5", true, "-0.125"],
    ];
    for (const [n, negate, expected] of cases) {
      await tap(root, "AC", n, ...(negate ? ["±"] : []), "%");
      expectDisplay(root, expected, `after ${negate ? "-" : ""}${n} %`);
    }
  });

  it("calculates with + − × ÷ xʸ ʸ√x and =, works out the pending result when another operator is pressed, and shows errors in the display", async () => {
    const cases: [string[], string][] = [
      [["6", "×", "3", "="], "18"],
      [["6", "+", "3", "="], "9"],
      [["6", "−", "3", "="], "3"],
      [["6", "÷", "3", "="], "2"],
      [["0.1", "+", "0.2", "="], "0.3"],
      [["1.5", "±", "+", "2", "="], "0.5"],
      [["3", "−", "8", "="], "-5"],
      [["2", "xʸ", "10", "="], "1024"],
      [["27", "ʸ√x", "3", "="], "3"],
      [["8", "±", "ʸ√x", "3", "="], "-2"],
    ];
    for (const [keys, expected] of cases) {
      const root = await calc(...keys);
      expectDisplay(root, expected, keys.join(" "));
    }

    // The second number replaces the first in the display while it's typed.
    let root = await calc("6", "×");
    await tap(root, "3");
    expectDisplay(root, "3", "6 × 3");

    // Another operator before = works out the pending result first.
    root = await calc("2", "+", "3", "×");
    expectDisplay(root, "5", "2 + 3 ×");
    await tap(root, "4", "=");
    expectDisplay(root, "20", "2 + 3 × 4 =");
    root = await calc("10", "−", "4", "−");
    expectDisplay(root, "6", "10 − 4 −");
    await tap(root, "1", "=");
    expectDisplay(root, "5", "10 − 4 − 1 =");

    // Errors show in the display instead of a number.
    const errors: [string[], string][] = [
      [["5", "÷", "0", "="], "Cannot divide by zero"],
      [["16", "±", "ʸ√x", "2", "="], "Cannot take an even root of a negative number"],
      [["8", "ʸ√x", "0", "="], "Root degree cannot be zero"],
      [["10", "xʸ", "400", "="], "Result is too large to show"],
    ];
    for (const [keys, message] of errors) {
      root = await calc(...keys);
      expectDisplayError(root, message, keys.join(" "));
    }

    // The next digit after an error starts a new entry, which calculates normally.
    root = await calc("5", "÷", "0", "=");
    expectDisplayError(root, "Cannot divide by zero", "5 ÷ 0 =");
    await tap(root, "7");
    expectDisplay(root, "7", "a digit after the error");
    await tap(root, "+", "1", "=");
    expectDisplay(root, "8", "7 + 1 = after the error");
  });

  it("applies √, sin, cos, tan, log and ln to the displayed number straight away, in degrees, and shows their errors", async () => {
    const cases: [string, Key, string][] = [
      ["16", "√", "4"],
      ["30", "sin", "0.5"],
      ["180", "sin", "0"],
      ["60", "cos", "0.5"],
      ["45", "tan", "1"],
      ["1000", "log", "3"],
      ["1", "ln", "0"],
    ];
    for (const [n, fn, expected] of cases) {
      const root = await calc(n, fn);
      expectDisplay(root, expected, `${n} ${fn}`);
    }

    // On a result, and on the second number of a pending calculation.
    let root = await calc("6", "+", "10", "=", "√");
    expectDisplay(root, "4", "6 + 10 = √");
    root = await calc("2", "+", "16", "√");
    expectDisplay(root, "4", "2 + 16 √");
    await tap(root, "=");
    expectDisplay(root, "6", "2 + 16 √ =");

    const errors: [string[], string][] = [
      [["4", "±", "√"], "Cannot take the square root of a negative number"],
      [["0", "log"], "Logarithm needs a positive number"],
      [["1", "±", "ln"], "Logarithm needs a positive number"],
      [["90", "tan"], "Tangent is undefined for this angle"],
    ];
    for (const [keys, message] of errors) {
      root = await calc(...keys);
      expectDisplayError(root, message, keys.join(" "));
    }

    // The next digit after an error starts a new entry.
    root = await calc("4", "±", "√");
    await tap(root, "9");
    expectDisplay(root, "9", "a digit after the error");
    await tap(root, "√");
    expectDisplay(root, "3", "9 √ after the error");
  });

  it("memory keys work on the display with an 'M: value' indicator, and calculations finished with = or a function key go to the History panel, whose 'Store in memory' sets memory", async () => {
    // m+ and m− with the displayed result, mr and mc.
    let root = render();
    expectNoMemoryIndicator(root, "when the app starts");
    await tap(root, "6", "+", "3", "=", "m+");
    expectMemory(root, 9, "6 + 3 = m+");
    expectDisplay(root, "9", "m+ leaves the display alone");
    await tap(root, "m+");
    expectMemory(root, 18, "m+ again");
    await tap(root, "8", "−", "5", "=", "m−");
    expectMemory(root, 15, "8 − 5 = m−");
    await tap(root, "AC");
    await tap(root, "mr");
    expectDisplay(root, "15", "mr");
    await tap(root, "+", "1", "=");
    expectDisplay(root, "16", "mr + 1 =");
    await tap(root, "mc");
    expectNoMemoryIndicator(root, "after mc");
    await tap(root, "mr");
    expectDisplay(root, "0", "mr after mc");

    // A typed number works too, and the indicator hides when memory is 0.
    root = render();
    await tap(root, "7", "m+");
    expectMemory(root, 7, "7 m+");
    await tap(root, "m−");
    expectNoMemoryIndicator(root, "7 m+ m−");
    await tap(root, "AC", "2.5", "±", "m+");
    expectMemory(root, -2.5, "-2.5 m+");

    // History: starts closed, = and function keys add entries at the top.
    root = render();
    await tap(root, "6", "×", "3", "=");
    expect(storeControls(root), "expected the History panel closed at first").toEqual([]);
    await toggleHistory(root);
    expectEntryAt(root, entryPattern("6", "×", "3", "18"), 0, "after 6 × 3 =");
    expect(historyEntries(root)).toHaveLength(1);
    await tap(root, "16", "√");
    expectEntryAt(root, /√\s*16\s*=\s*4(?![\d.])/, 0, "after 16 √");
    await tap(root, "0.1", "+", "0.2", "=");
    expectEntryAt(root, entryPattern("0.1", "+", "0.2", "0.3"), 0, "after 0.1 + 0.2 =");
    expect(historyEntries(root)).toHaveLength(3);

    // Errors add no entry.
    await tap(root, "5", "÷", "0", "=");
    expect(historyEntries(root), "an error should add no entry").toHaveLength(3);

    // The key closes and reopens the panel.
    await toggleHistory(root);
    expect(storeControls(root), "expected the History key to close the panel").toEqual([]);
    expect(visibleText(root, true)).not.toMatch(/6\s*×\s*3\s*=\s*18/);
    await toggleHistory(root);
    expect(historyEntries(root)).toHaveLength(3);

    // 'Store in memory' sets memory to the entry's result.
    const store = (pattern: RegExp): HTMLElement => {
      const entry = historyEntries(root).find((e) => pattern.test(e.text));
      expect(entry, `expected an entry ${pattern}`).toBeDefined();
      return entry!.store;
    };
    store(entryPattern("6", "×", "3", "18")).click();
    await settle();
    expectMemory(root, 18, "Store in memory on '6 × 3 = 18'");
    store(/√\s*16\s*=\s*4(?![\d.])/).click();
    await settle();
    expectMemory(root, 4, "Store in memory on '√16 = 4' replaces memory");
    expect(historyEntries(root), "storing adds no entry").toHaveLength(3);
  });

  it("works from the keyboard like the keys, and leaves no editable text fields or dropdowns on the page", async () => {
    const root = render();
    focusOutside();
    await type("6*3");
    expectDisplay(root, "3", "typing 6*3");
    await press("Enter");
    expectDisplay(root, "18", "6*3 Enter");
    await press("Escape");
    expectDisplay(root, "0", "Escape");

    await type("8-5=");
    expectDisplay(root, "3", "8-5=");
    await press("Escape");
    await type("9/3");
    await press("Enter");
    expectDisplay(root, "3", "9/3 Enter");
    await press("Escape");
    await type("1.5+1");
    await press("Enter");
    expectDisplay(root, "2.5", "1.5+1 Enter");
    await press("Escape");
    await type("2+3*");
    expectDisplay(root, "5", "2+3*");
    await press("Escape");
    expectDisplay(root, "0", "Escape");

    // Backspace deletes the last digit.
    await type("123");
    expectDisplay(root, "123", "typing 123");
    await press("Backspace");
    expectDisplay(root, "12", "123 Backspace");
    await press("Backspace");
    expectDisplay(root, "1", "123 Backspace Backspace");
    await type(".5");
    expectDisplay(root, "1.5", "1 .5");
    await press("Backspace");
    expectDisplay(root, "1.", "1.5 Backspace");
    await press("Escape");

    // % and a single decimal point.
    await type("50%");
    expectDisplay(root, "0.5", "50%");
    await press("Escape");
    await type("1..5");
    expectDisplay(root, "1.5", "1..5");
    await press("Escape");

    // Errors from the keyboard too.
    await type("5/0");
    await press("Enter");
    expectDisplayError(root, "Cannot divide by zero", "5/0 Enter");
    await type("4");
    expectDisplay(root, "4", "a digit after the error");

    // No editable text fields or dropdowns, even after using every part.
    expect(editableFields(root), "expected no editable text fields or dropdowns").toEqual([]);
    await tap(root, "m+", "mr");
    await toggleHistory(root);
    const mc = findKey(root, "mc");
    if (mc) mc.click();
    await settle();
    expect(editableFields(root), "expected no editable text fields or dropdowns").toEqual([]);
    expect(display(root)).not.toBe("");
  });
});
