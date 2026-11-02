import { describe, expect, it } from "vitest";
import {
  editableFields,
  entryPattern,
  expectDisplay,
  expectMemory,
  expectNoMemoryIndicator,
  historyEntries,
  openHistory,
  render,
  settle,
  tap,
  useApp,
  visibleText,
} from "./keypad-helpers";

// These tests drive the calculator's memory keys (mc, mr, m+, m−), the memory
// indicator and the history panel's 'Store in memory' controls from the
// keypad the way a user would (see keypad-helpers.ts).

useApp();

function storeFor(root: HTMLElement, pattern: RegExp): HTMLElement {
  const entry = historyEntries(root).find((e) => pattern.test(e.text));
  expect(entry, `expected a history entry ${pattern}, page showed: "${visibleText(root)}"`).toBeDefined();
  return entry!.store;
}

describe("memory", () => {
  it("m+ adds and m− subtracts the displayed number; with an error shown both leave memory unchanged", async () => {
    const root = render();
    await tap(root, "6", "+", "3", "=", "m+");
    expectMemory(root, 9, "6 + 3 = 9 then m+");
    await tap(root, "m+");
    expectMemory(root, 18, "m+ a second time");
    await tap(root, "8", "−", "5", "=", "m−");
    expectMemory(root, 15, "8 − 5 = 3 then m−");

    // Negative and decimal numbers.
    await tap(root, "1", "−", "3.5", "=", "m+");
    expectMemory(root, 12.5, "1 − 3.5 = -2.5 then m+");
    await tap(root, "m−", "m−");
    expectMemory(root, 17.5, "m− twice with -2.5");

    // A typed number, not just a result.
    await tap(root, "AC", "0.5", "m+");
    expectMemory(root, 18, "0.5 typed then m+");

    // With an error in the display nothing changes.
    await tap(root, "5", "÷", "0", "=", "m+", "m−", "m+");
    expectMemory(root, 18, "m+/m− with 'Cannot divide by zero' shown");

    // Once a number is shown again, m+ works again.
    await tap(root, "2", "×", "2", "=", "m+");
    expectMemory(root, 22, "2 × 2 = 4 then m+");
  });

  it("mr puts the memory value into the display and mc sets memory back to 0", async () => {
    const root = render();
    await tap(root, "6", "×", "3", "=", "m+");
    await tap(root, "1", "−", "3.5", "=", "m+");
    expectMemory(root, 15.5, "m+ with 18 and -2.5");

    await tap(root, "42", "mr");
    expectDisplay(root, "15.5", "mr replaces the typed 42");
    expectMemory(root, 15.5, "mr leaves memory unchanged");

    // The recalled value can be used in a calculation, as either number.
    await tap(root, "+", "0.5", "=");
    expectDisplay(root, "16", "mr + 0.5 =");
    await tap(root, "2", "×", "mr", "=");
    expectDisplay(root, "31", "2 × mr =");

    // A negative memory value.
    await tap(root, "20", "m−");
    expectMemory(root, -4.5, "m− with 20");
    await tap(root, "AC", "mr");
    expectDisplay(root, "-4.5", "mr with memory -4.5");

    await tap(root, "mc");
    expectNoMemoryIndicator(root, "after mc");
    await tap(root, "7", "mr");
    expectDisplay(root, "0", "mr after mc");

    await tap(root, "6", "+", "3", "=", "m+");
    expectMemory(root, 9, "mc then 6 + 3 = 9 and m+");
  });

  it("shows an 'M: value' indicator while memory isn't 0 and hides it while memory is 0", async () => {
    const root = render();
    expectNoMemoryIndicator(root, "when the app starts");
    await tap(root, "6", "+", "3", "=");
    expectNoMemoryIndicator(root, "after a calculation without m+");
    await tap(root, "m+");
    expect(visibleText(root, true)).toMatch(/(?<![A-Za-z])M(?:emory)?\s*:\s*9(?![\d.])/i);

    await tap(root, "2", "×", "5", "=");
    expectMemory(root, 9, "after another calculation");
    await tap(root, "AC");
    expectMemory(root, 9, "AC leaves memory alone");

    await tap(root, "6", "+", "3", "=", "m−");
    expectNoMemoryIndicator(root, "m− brings memory back to 0");

    await tap(root, "3", "±", "m+");
    expectMemory(root, -3, "-3 m+");
    await tap(root, "mc");
    expectNoMemoryIndicator(root, "after mc");
  });

  it("each history entry has a 'Store in memory' control that sets memory to that entry's result", async () => {
    const root = render();
    await tap(root, "6", "×", "3", "=");
    await tap(root, "8", "−", "5", "=");
    await tap(root, "16", "√");
    await openHistory(root);
    expect(historyEntries(root)).toHaveLength(3);

    storeFor(root, entryPattern("6", "×", "3", "18")).click();
    await settle();
    expectMemory(root, 18, "Store in memory on '6 × 3 = 18'");
    storeFor(root, entryPattern("8", "−", "5", "3")).click();
    await settle();
    expectMemory(root, 3, "Store in memory on '8 − 5 = 3' replaces memory");
    storeFor(root, /√\s*16\s*=\s*4(?![\d.])/).click();
    await settle();
    expectMemory(root, 4, "Store in memory on '√16 = 4'");
    expect(historyEntries(root), "storing adds no entry").toHaveLength(3);

    // The stored value works with the memory keys.
    await tap(root, "AC", "mr");
    expectDisplay(root, "4", "mr after storing 4");
    await tap(root, "m+");
    expectMemory(root, 8, "m+ with 4 after storing 4");

    // Storing a 0 result hides the indicator.
    await tap(root, "3", "−", "3", "=");
    storeFor(root, entryPattern("3", "−", "3", "0")).click();
    await settle();
    expectNoMemoryIndicator(root, "Store in memory on '3 − 3 = 0'");
  });

  it("adds no editable inputs", async () => {
    const root = render();
    expect(editableFields(root)).toEqual([]);
    await tap(root, "6", "+", "3", "=", "m+", "mr");
    await openHistory(root);
    storeFor(root, entryPattern("6", "+", "3", "9")).click();
    await settle();
    await tap(root, "mc");
    expect(editableFields(root)).toEqual([]);
  });
});
