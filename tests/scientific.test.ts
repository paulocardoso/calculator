import { describe, expect, it } from "vitest";
import {
  calc,
  display,
  entryPattern,
  expectDisplay,
  expectDisplayError,
  expectEntryAt,
  historyEntries,
  render,
  tap,
  toggleHistory,
  useApp,
  visibleText,
} from "./keypad-helpers";

// Acceptance tests for the xʸ (power) and ʸ√x (root) keys, driven from the
// keypad the way a user would (see keypad-helpers.ts).

useApp();

const NOT_A_NUMBER = /infinity|nan|∞/i;

describe("power and root", () => {
  it("2 xʸ 10 = shows 1024 and adds '2 ^ 10 = 1024' at the top of the history", async () => {
    const root = render();
    await tap(root, "6", "×", "3", "=");
    await tap(root, "2", "xʸ", "10", "=");
    expectDisplay(root, "1024", "2 xʸ 10 =");

    await toggleHistory(root);
    expectEntryAt(root, /(?<![\d.])2 \^ 10 = 1024(?![\d.])/, 0, "after 2 xʸ 10 =");
    expectEntryAt(root, entryPattern("6", "×", "3", "18"), 1, "after 2 xʸ 10 =");
    expect(historyEntries(root)).toHaveLength(2);

    // Calculating while the panel is open puts the new entry at the top too.
    await tap(root, "3", "xʸ", "2", "=");
    expectEntryAt(root, entryPattern("3", "^", "2", "9"), 0, "after 3 xʸ 2 =");
    expect(historyEntries(root)).toHaveLength(3);
  });

  it("27 ʸ√x 3 = shows 3, and -8 ʸ√x 3 = shows -2", async () => {
    let root = await calc("27", "ʸ√x", "3", "=");
    expectDisplay(root, "3", "27 ʸ√x 3 =");
    root = await calc("8", "±", "ʸ√x", "3", "=");
    expectDisplay(root, "-2", "-8 ʸ√x 3 =");
    root = await calc("16", "ʸ√x", "4", "=");
    expectDisplay(root, "2", "16 ʸ√x 4 =");

    // The history entry reads 'a √ b'.
    await toggleHistory(root);
    expectEntryAt(root, entryPattern("16", "√", "4", "2"), 0, "after 16 ʸ√x 4 =");
  });

  it("shows an error and adds no history entry for an even root of a negative number or a root degree of 0", async () => {
    const cases: [string[], string][] = [
      [["16", "±", "ʸ√x", "2", "="], "Cannot take an even root of a negative number"],
      [["16", "±", "ʸ√x", "4", "="], "Cannot take an even root of a negative number"],
      [["8", "ʸ√x", "0", "="], "Root degree cannot be zero"],
      [["8", "±", "ʸ√x", "0", "="], "Root degree cannot be zero"],
      [["0", "ʸ√x", "0", "="], "Root degree cannot be zero"],
    ];
    for (const [keys, message] of cases) {
      const root = await calc(...keys);
      expectDisplayError(root, message, keys.join(" "));
      await toggleHistory(root);
      expect(historyEntries(root), `expected no history entry for ${keys.join(" ")}`).toHaveLength(0);
    }

    // After a successful calculation, errors add nothing to the history.
    const root = await calc("6", "×", "3", "=");
    await tap(root, "16", "±", "ʸ√x", "2", "=");
    expectDisplayError(root, "Cannot take an even root of a negative number", "-16 ʸ√x 2 =");
    await tap(root, "8", "ʸ√x", "0", "=");
    expectDisplayError(root, "Root degree cannot be zero", "8 ʸ√x 0 =");
    await toggleHistory(root);
    expect(historyEntries(root)).toHaveLength(1);
  });

  it("10 xʸ 400 = shows 'Result is too large to show', adds no history entry, and nothing ever shows Infinity or NaN", async () => {
    let root = await calc("10", "xʸ", "400", "=");
    expectDisplayError(root, "Result is too large to show", "10 xʸ 400 =");
    await toggleHistory(root);
    expect(historyEntries(root)).toHaveLength(0);

    const tricky: string[][] = [
      ["0", "xʸ", "1", "±", "="],
      ["8", "±", "xʸ", "0.5", "="],
      ["10", "ʸ√x", "0.001", "="],
      ["8", "±", "ʸ√x", "0.5", "="],
    ];
    for (const keys of tricky) {
      root = await calc(...keys);
      expect(display(root), keys.join(" ")).not.toMatch(NOT_A_NUMBER);
      await toggleHistory(root);
      expect(visibleText(root), keys.join(" ")).not.toMatch(NOT_A_NUMBER);
    }
    root = await calc("0", "xʸ", "1", "±", "=");
    expectDisplayError(root, "Cannot divide by zero", "0 xʸ -1 =");
  });
});
