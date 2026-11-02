import { describe, expect, it } from "vitest";
import {
  expectDisplay,
  expectDisplayError,
  focusOutside,
  press,
  render,
  tap,
  type,
  useApp,
  type Modifiers,
} from "./keypad-helpers";

// These tests drive the calculator from the keyboard the way a user would,
// reading the result from the single display (see keypad-helpers.ts).

useApp();

describe("keyboard", () => {
  it("types digits and '.' into the display, with at most one decimal point", async () => {
    const root = render();
    focusOutside();
    await type("1.5");
    expectDisplay(root, "1.5", "typing 1.5");
    await type(".2");
    expectDisplay(root, "1.52", "typing 1.5.2");
    await press("Escape");
    await type("007");
    expectDisplay(root, "7", "typing 007");
  });

  it("chooses +, −, × and ÷ with + - * / and calculates with Enter or =", async () => {
    const cases: [string, string][] = [
      ["+", "9"],
      ["-", "3"],
      ["*", "18"],
      ["/", "2"],
    ];
    for (const finish of ["Enter", "="]) {
      for (const [op, expected] of cases) {
        const root = render();
        focusOutside();
        await type(`6${op}3`);
        expectDisplay(root, "3", `typing 6${op}3`);
        await press(finish);
        expectDisplay(root, expected, `6${op}3 ${finish}`);
      }
    }

    // Keys mix with clicks on the keypad.
    const root = render();
    await tap(root, "6");
    focusOutside();
    await press("*");
    await tap(root, "3");
    focusOutside();
    await press("Enter");
    expectDisplay(root, "18", "6 (click) * (key) 3 (click) Enter");

    // Errors appear in the display.
    focusOutside();
    await type("5/0");
    await press("Enter");
    expectDisplayError(root, "Cannot divide by zero", "5/0 Enter");
  });

  it("clears with Escape like AC, after a result or an error", async () => {
    const root = render();
    focusOutside();
    await type("6+3");
    await press("Enter");
    expectDisplay(root, "9", "6+3 Enter");
    await press("Escape");
    expectDisplay(root, "0", "Escape after a result");

    await type("5/0");
    await press("Enter");
    await press("Escape");
    expectDisplay(root, "0", "Escape after an error");

    // A pending operation is cleared too.
    await type("6+3");
    await press("Escape");
    await type("2=");
    expectDisplay(root, "2", "Escape then 2 =");
  });

  it("deletes the last digit with Backspace", async () => {
    const root = render();
    focusOutside();
    await type("1234");
    await press("Backspace");
    expectDisplay(root, "123", "1234 Backspace");
    await press("Backspace");
    await press("Backspace");
    expectDisplay(root, "1", "1234 Backspace ×3");
    await type("+56");
    await press("Backspace");
    expectDisplay(root, "5", "1+56 Backspace");
    await press("Enter");
    expectDisplay(root, "6", "1+5 Enter");
  });

  it("ignores keys pressed with Ctrl, Meta or Alt", async () => {
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }] as Modifiers[]) {
      const name = Object.keys(mod)[0];
      const root = render();
      focusOutside();
      await type("12");
      for (const k of ["3", "+", "Backspace", "Escape"]) {
        const handled = await press(k, mod);
        expect(handled, `${k} with ${name} should be left to the browser`).toBe(false);
      }
      expectDisplay(root, "12", `keys with ${name}`);
    }
  });
});
