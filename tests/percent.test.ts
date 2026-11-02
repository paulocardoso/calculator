import { describe, expect, it } from "vitest";
import { formatNumber } from "../src/app";
import {
  calc,
  expectDisplay,
  focusOutside,
  historyEntries,
  key,
  press,
  render,
  tap,
  toggleHistory,
  type,
  useApp,
  visibleText,
  type Modifiers,
} from "./keypad-helpers";

// These tests drive the calculator's % key (on the keypad and on the
// keyboard) the way a user would (see keypad-helpers.ts).

useApp();

describe("percent", () => {
  it("shows a '%' key that divides the displayed number by 100, without adding history", async () => {
    const root = render();
    const btn = key(root, "%");
    expect((btn.textContent ?? "").trim(), "expected the key to be labelled '%'").toBe("%");

    await tap(root, "50", "%");
    expectDisplay(root, "0.5", "50 %");
    await tap(root, "%");
    expectDisplay(root, "0.005", "50 % %");

    await toggleHistory(root);
    expect(visibleText(root).toLowerCase()).toContain("no calculations yet");
    expect(historyEntries(root)).toHaveLength(0);
  });

  it("works on the second number: 200 + 10 % = shows 200.1", async () => {
    const root = await calc("200", "+", "10", "%");
    expectDisplay(root, "0.1", "200 + 10 %");
    await tap(root, "=");
    expectDisplay(root, "200.1", "200 + 10 % =");
  });

  it("works on a result: 6 × 3 = % shows 0.18", async () => {
    const root = await calc("6", "×", "3", "=", "%");
    expectDisplay(root, "0.18", "6 × 3 = %");
  });

  it("produces values without floating point noise, formatted like results", async () => {
    const cases: [string, boolean, string][] = [
      ["33", false, "0.33"],
      ["0.3", false, "0.003"],
      ["0.07", false, "0.0007"],
      ["1.1", false, "0.011"],
      ["12.5", true, "-0.125"],
      ["7", false, "0.07"],
    ];
    for (const [n, negate, expected] of cases) {
      const root = await calc(n, ...(negate ? ["±"] : []), "%");
      expectDisplay(root, expected, `${negate ? "-" : ""}${n} %`);
      expect(expected).toBe(formatNumber(Number(n) * (negate ? -1 : 1) / 100));
    }
  });

  it("applies % from the keyboard, and ignores it with Ctrl, Meta or Alt", async () => {
    let root = render();
    focusOutside();
    await type("50");
    await press("%");
    expectDisplay(root, "0.5", "typing 50%");

    root = render();
    focusOutside();
    await type("200+10%");
    expectDisplay(root, "0.1", "typing 200+10%");
    await press("Enter");
    expectDisplay(root, "200.1", "typing 200+10% Enter");

    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }] as Modifiers[]) {
      root = render();
      focusOutside();
      await type("50");
      const handled = await press("%", mod);
      expectDisplay(root, "50", `% with ${Object.keys(mod)[0]}`);
      expect(handled, `% with ${Object.keys(mod)[0]} should be left to the browser`).toBe(false);
    }
  });
});
