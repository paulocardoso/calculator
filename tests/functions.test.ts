import { describe, expect, it } from "vitest";
import {
  calc,
  display,
  entryPattern,
  expectDisplay,
  expectDisplayError,
  expectEntryAt,
  historyEntries,
  key,
  render,
  tap,
  toggleHistory,
  useApp,
  type Key,
} from "./keypad-helpers";

// Acceptance tests for the single-number function keys (√, sin, cos, tan,
// log and ln), driven from the keypad the way a user would (see
// keypad-helpers.ts).

useApp();

const FNS: Key[] = ["√", "sin", "cos", "tan", "log", "ln"];

describe("single-number functions", () => {
  it("offers √, sin, cos, tan, log and ln as separate keys", () => {
    const root = render();
    const keys = FNS.map((fn) => key(root, fn));
    expect(new Set(keys).size, "expected six distinct function keys").toBe(6);
  });

  it("shows 4 for √16, 3 for log 1000, 0 for ln 1, and 0.5, 0.5 and 1 for sin 30, cos 60 and tan 45 (degrees)", async () => {
    const cases: [string, Key, string][] = [
      ["16", "√", "4"],
      ["1000", "log", "3"],
      ["1", "ln", "0"],
      ["30", "sin", "0.5"],
      ["60", "cos", "0.5"],
      ["45", "tan", "1"],
      ["90", "cos", "0"],
      ["450", "sin", "1"],
    ];
    for (const [n, fn, expected] of cases) {
      const root = await calc(n, fn);
      expectDisplay(root, expected, `${n} ${fn}`);
    }

    // On one page, functions and two-number calculations mix.
    const root = await calc("16", "√");
    expectDisplay(root, "4", "16 √");
    await tap(root, "6", "×", "3", "=");
    expectDisplay(root, "18", "6 × 3 = after 16 √");
    await tap(root, "45", "tan");
    expectDisplay(root, "1", "45 tan after 6 × 3 =");
    await tap(root, "60", "cos");
    expectDisplay(root, "0.5", "60 cos");
  });

  it("shows an error and adds no history entry for √ of a negative number, log of 0 or a negative number, and tan of 90 or 270", async () => {
    const cases: [string[], string][] = [
      [["4", "±", "√"], "Cannot take the square root of a negative number"],
      [["0.25", "±", "√"], "Cannot take the square root of a negative number"],
      [["0", "log"], "Logarithm needs a positive number"],
      [["10", "±", "log"], "Logarithm needs a positive number"],
      [["0", "ln"], "Logarithm needs a positive number"],
      [["1", "±", "ln"], "Logarithm needs a positive number"],
      [["90", "tan"], "Tangent is undefined for this angle"],
      [["270", "tan"], "Tangent is undefined for this angle"],
    ];
    for (const [keys, message] of cases) {
      const root = await calc(...keys);
      expectDisplayError(root, message, keys.join(" "));
      await toggleHistory(root);
      expect(historyEntries(root), `expected no history entry for ${keys.join(" ")}`).toHaveLength(0);
    }

    // After a successful calculation, each error replaces its result and adds
    // nothing to the history.
    const root = await calc("6", "×", "3", "=");
    for (const [keys, message] of cases) {
      await tap(root, "AC", ...keys);
      expectDisplayError(root, message, keys.join(" "));
      expect(display(root)).not.toContain("18");
    }
    await toggleHistory(root);
    expect(historyEntries(root)).toHaveLength(1);
  });

  it("adds a history entry at the top for each successful function, showing the function, its input and the formatted result", async () => {
    const root = render();
    await tap(root, "6", "×", "3", "=");
    await tap(root, "16", "√");
    await toggleHistory(root);
    expectEntryAt(root, /√\s*16\s*=\s*4(?![\d.])/, 0, "after 16 √");
    expectEntryAt(root, entryPattern("6", "×", "3", "18"), 1, "after 16 √");

    const entries: [string, Key, RegExp][] = [
      ["30", "sin", /sin\s*\(\s*30\s*°?\s*\)\s*=\s*0\.5(?![\d.])/i],
      ["60", "cos", /cos\s*\(\s*60\s*°?\s*\)\s*=\s*0\.5(?![\d.])/i],
      ["45", "tan", /tan\s*\(\s*45\s*°?\s*\)\s*=\s*1(?![\d.])/i],
      ["1000", "log", /log\s*(?:10|₁₀)?\s*\(\s*1000\s*\)\s*=\s*3(?![\d.])/i],
      ["1", "ln", /ln\s*\(\s*1\s*\)\s*=\s*0(?![\d.])/i],
    ];
    for (const [i, [n, fn, pattern]] of entries.entries()) {
      await tap(root, n, fn);
      expectEntryAt(root, pattern, 0, `after ${n} ${fn}`);
      expect(historyEntries(root)).toHaveLength(3 + i);
    }

    // A two-number calculation after them still goes to the top.
    await tap(root, "2", "xʸ", "10", "=");
    expectEntryAt(root, entryPattern("2", "^", "10", "1024"), 0, "after 2 xʸ 10 =");
    expect(historyEntries(root)).toHaveLength(3 + entries.length);
  });
});
