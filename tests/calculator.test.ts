import { describe, expect, it } from "vitest";
import { calc, display, expectDisplay, expectDisplayError, tap, useApp } from "./keypad-helpers";

// These tests drive the calculator's keypad the way a user would: keys are
// found by their labels (see keypad-helpers.ts) and results are read from the
// single display. They don't rely on ids, classes or test ids.

useApp();

describe("calculator", () => {
  it("shows 9, 3, 18 and 2 for 6 and 3 with +, −, × and ÷", async () => {
    const cases: [string, string][] = [
      ["+", "9"],
      ["−", "3"],
      ["×", "18"],
      ["÷", "2"],
    ];
    for (const [op, expected] of cases) {
      const root = await calc("6", op, "3", "=");
      expectDisplay(root, expected, `6 ${op} 3 =`);
    }
    // A new calculation after = replaces the result.
    const root = await calc("6", "×", "3", "=");
    expectDisplay(root, "18", "6 × 3 =");
    await tap(root, "6", "÷", "3", "=");
    expectDisplay(root, "2", "6 ÷ 3 = after 6 × 3 =");
  });

  it("handles decimal and negative inputs: -1.5 + 2 shows 0.5 and 0.1 + 0.2 shows 0.3", async () => {
    let root = await calc("1.5", "±", "+", "2", "=");
    expectDisplay(root, "0.5", "-1.5 + 2 =");
    root = await calc("0.1", "+", "0.2", "=");
    expectDisplay(root, "0.3", "0.1 + 0.2 =");
    root = await calc("2", "−", "3.5", "=");
    expectDisplay(root, "-1.5", "2 − 3.5 =");
    root = await calc("4", "×", "2.5", "±", "=");
    expectDisplay(root, "-10", "4 × -2.5 =");
  });

  it("shows 'Cannot divide by zero' instead of a result when dividing by 0", async () => {
    for (const a of [["5"], ["2.5", "±"], ["0"]]) {
      const root = await calc(...a, "÷", "0", "=");
      expectDisplayError(root, "Cannot divide by zero", `${a.join(" ")} ÷ 0 =`);
    }
    // A previous result is replaced by the error.
    const root = await calc("6", "+", "3", "=");
    expectDisplay(root, "9", "6 + 3 =");
    await tap(root, "6", "÷", "0", "=");
    expectDisplayError(root, "Cannot divide by zero", "6 ÷ 0 = after 6 + 3 =");
    expect(display(root)).not.toContain("9");
  });
});
