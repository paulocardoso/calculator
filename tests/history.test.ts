import { describe, expect, it } from "vitest";
import {
  entryPattern,
  expectEntryAt,
  historyEntries,
  key,
  render,
  storeControls,
  tap,
  toggleHistory,
  useApp,
  visibleText,
} from "./keypad-helpers";

// These tests drive the calculator's keypad and its History panel the way a
// user would (see keypad-helpers.ts). Each history entry has its own 'Store
// in memory' control, which is how entries are found.

useApp();

describe("history", () => {
  it("adds an entry showing operands, operation and formatted result for each calculation finished with =, newest first", async () => {
    const root = render();
    await tap(root, "6", "×", "3", "=");
    await tap(root, "8", "−", "5", "=");
    await toggleHistory(root);
    expectEntryAt(root, entryPattern("8", "−", "5", "3"), 0, "after 8 − 5 =");
    expectEntryAt(root, entryPattern("6", "×", "3", "18"), 1, "after 8 − 5 =");
    expect(historyEntries(root)).toHaveLength(2);

    // While the panel is open, with the result formatted (0.1 + 0.2 = 0.3).
    await tap(root, "0.1", "+", "0.2", "=");
    expectEntryAt(root, entryPattern("0.1", "+", "0.2", "0.3"), 0, "after 0.1 + 0.2 =");
    expect(visibleText(root)).not.toContain("0.30000000000000004");
    expect(historyEntries(root)).toHaveLength(3);

    // Negative operands and results.
    await tap(root, "2", "±", "−", "3", "=");
    expectEntryAt(root, entryPattern("-2", "−", "3", "-5"), 0, "after -2 − 3 =");

    // Repeating the same calculation adds another entry.
    await tap(root, "6", "÷", "3", "=");
    await tap(root, "6", "÷", "3", "=");
    expectEntryAt(root, entryPattern("6", "÷", "3", "2"), 0, "after 6 ÷ 3 = twice");
    expect(historyEntries(root)).toHaveLength(6);
  });

  it("adds no entry for calculations that end in an error", async () => {
    let root = render();
    await tap(root, "5", "÷", "0", "=");
    await tap(root, "10", "xʸ", "400", "=");
    await toggleHistory(root);
    expect(historyEntries(root)).toHaveLength(0);
    expect(visibleText(root)).not.toMatch(/infinity|nan|∞/i);

    root = render();
    await tap(root, "6", "×", "3", "=");
    await tap(root, "5", "÷", "0", "=");
    await toggleHistory(root);
    expect(historyEntries(root)).toHaveLength(1);
    await tap(root, "7", "÷", "0", "=");
    expect(historyEntries(root)).toHaveLength(1);
    expectEntryAt(root, entryPattern("6", "×", "3", "18"), 0, "after errors");
  });

  it("shows and hides the panel with the History key; it starts hidden", async () => {
    const root = render();
    key(root, "History");
    expect(visibleText(root).toLowerCase()).not.toContain("no calculations yet");

    await tap(root, "6", "×", "3", "=");
    expect(storeControls(root), "expected entries hidden while the panel is closed").toEqual([]);

    await toggleHistory(root);
    expectEntryAt(root, entryPattern("6", "×", "3", "18"), 0, "after opening the panel");

    await toggleHistory(root);
    expect(storeControls(root), "expected the panel to close").toEqual([]);

    // Entries added while closed show when it reopens.
    await tap(root, "8", "−", "5", "=");
    expect(storeControls(root)).toEqual([]);
    await toggleHistory(root);
    expectEntryAt(root, entryPattern("8", "−", "5", "3"), 0, "after reopening");
    expectEntryAt(root, entryPattern("6", "×", "3", "18"), 1, "after reopening");
  });

  it("shows 'No calculations yet' when opened before any calculation", async () => {
    const root = render();
    await toggleHistory(root);
    expect(visibleText(root).toLowerCase()).toContain("no calculations yet");
    expect(historyEntries(root)).toHaveLength(0);

    await tap(root, "6", "×", "3", "=");
    expect(historyEntries(root)).toHaveLength(1);
    expect(visibleText(root).toLowerCase()).not.toContain("no calculations yet");
  });
});
