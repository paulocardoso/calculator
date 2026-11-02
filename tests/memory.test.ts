import { afterEach, describe, expect, it } from "vitest";
import { mount } from "../src/app";

// These tests drive the calculator's memory keys (M+, M−, MR, MC), the memory
// indicator and the history panel's 'Store in memory' controls the way a user
// would: controls are found by what the user sees (input fields, option and
// button labels) and assertions are made on the page's visible text and the
// first number field's value. They don't rely on ids, classes or test ids.

type Op = "add" | "subtract" | "multiply" | "divide";

const OP_PATTERNS: Record<Op, RegExp> = {
  add: /add|plus|sum|^\s*\+\s*$/i,
  subtract: /subtract|minus|difference|^\s*[-−–]\s*$/i,
  multiply: /multipl|times|product|^\s*[×*✕x]\s*$/i,
  divide: /divi|quotient|^\s*[÷/]\s*$/i,
};
const OPS: Op[] = ["add", "subtract", "multiply", "divide"];

type MemoryKey = "plus" | "minus" | "recall" | "clear";

// Each memory key may be labelled with its short name ('M+') or spelled out
// ('Memory plus'), in its text, aria-label or title.
const MEMORY_PATTERNS: Record<MemoryKey, RegExp[]> = {
  plus: [/^\s*M\s*\+\s*$/i, /^\s*memory\s*(plus|add)\s*$/i],
  minus: [/^\s*M\s*[-−–]\s*$/i, /^\s*memory\s*(minus|subtract)\s*$/i],
  recall: [/^\s*MR\s*$/i, /^\s*(memory\s*recall|recall\s*memory)\s*$/i],
  clear: [/^\s*MC\s*$/i, /^\s*(memory\s*clear|clear\s*memory)\s*$/i],
};
const MEMORY_KEYS: MemoryKey[] = ["plus", "minus", "recall", "clear"];
const MEMORY_KEY_NAMES: Record<MemoryKey, string> = {
  plus: "M+",
  minus: "M−",
  recall: "MR",
  clear: "MC",
};

const STORE_PATTERN = /store.*memory/i;

const NON_OPERAND_TYPES = new Set([
  "radio",
  "checkbox",
  "button",
  "submit",
  "reset",
  "hidden",
  "image",
  "file",
  "range",
  "color",
]);

let roots: HTMLElement[] = [];

afterEach(() => {
  for (const r of roots) r.remove();
  roots = [];
});

function render(): HTMLElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  roots.push(root);
  mount(root);
  return root;
}

function isHidden(el: Element): boolean {
  if (el instanceof HTMLElement && el.hidden) return true;
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "template") return true;
  const style = window.getComputedStyle(el);
  return style.display === "none" || style.visibility === "hidden";
}

function isVisible(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (isHidden(node)) return false;
  }
  return true;
}

// The text a user can see in root, including values of read-only/disabled
// fields.
function visibleText(root: Element): string {
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (!(node instanceof Element)) return;
    if (isHidden(node)) return;
    if (
      node instanceof HTMLInputElement &&
      (node.readOnly || node.disabled) &&
      !NON_OPERAND_TYPES.has(node.type)
    ) {
      parts.push(" " + node.value + " ");
    }
    if (node instanceof HTMLTextAreaElement && (node.readOnly || node.disabled)) {
      parts.push(" " + node.value + " ");
    }
    for (const child of Array.from(node.childNodes)) walk(child);
    parts.push(" ");
  };
  walk(root);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function operandInputs(root: HTMLElement): HTMLInputElement[] {
  return Array.from(root.querySelectorAll("input")).filter(
    (i) => !NON_OPERAND_TYPES.has(i.type) && !i.readOnly && !i.disabled && isVisible(i),
  );
}

// The separate labels a control shows: its text or value, its <label>s, its
// aria-label and its title.
function labelParts(el: HTMLElement): string[] {
  const parts: string[] = [];
  if (el instanceof HTMLInputElement) {
    parts.push(el.value);
    for (const l of Array.from(el.labels ?? [])) parts.push(l.textContent ?? "");
  } else {
    parts.push(el.textContent ?? "");
  }
  parts.push(el.getAttribute("aria-label") ?? "");
  parts.push(el.getAttribute("title") ?? "");
  return parts.map((p) => p.trim()).filter((p) => p !== "");
}

function labelText(el: HTMLElement): string {
  return labelParts(el).join(" ");
}

function matchesOp(text: string, op: Op): boolean {
  return text
    .split(/\s{2,}|\n/)
    .concat([text])
    .some((t) => OP_PATTERNS[op].test(t.trim()));
}

function buttons(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, input[type="submit"], input[type="button"], [role="button"]',
    ),
  ).filter((b) => isVisible(b));
}

function isMemoryKey(b: HTMLElement, key: MemoryKey): boolean {
  return labelParts(b).some((p) => MEMORY_PATTERNS[key].some((re) => re.test(p)));
}

function isAnyMemoryKey(b: HTMLElement): boolean {
  return MEMORY_KEYS.some((k) => isMemoryKey(b, k));
}

function isStoreControl(b: HTMLElement): boolean {
  return labelParts(b).some((p) => STORE_PATTERN.test(p));
}

function isHistoryButton(b: HTMLElement): boolean {
  return /history/i.test(labelText(b)) && !isStoreControl(b);
}

function isSpecialButton(b: HTMLElement): boolean {
  return isHistoryButton(b) || isAnyMemoryKey(b) || isStoreControl(b);
}

function opButton(root: HTMLElement, op: Op): HTMLElement | undefined {
  return buttons(root).find((b) => {
    if (isSpecialButton(b)) return false;
    const t = labelText(b);
    return matchesOp(t, op) && !OPS.some((o) => o !== op && matchesOp(t, o));
  });
}

interface OpControl {
  kind: "select" | "radio" | "button";
  choose: () => void;
}

function findOpControl(root: HTMLElement, op: Op): OpControl | undefined {
  for (const select of Array.from(root.querySelectorAll("select"))) {
    const option = Array.from(select.options).find(
      (o) => matchesOp(o.value, op) || matchesOp(o.textContent ?? "", op),
    );
    if (option) {
      return {
        kind: "select",
        choose: () => {
          select.value = option.value;
          option.selected = true;
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
        },
      };
    }
  }
  const radio = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
    (r) => matchesOp(labelText(r), op),
  );
  if (radio) return { kind: "radio", choose: () => radio.click() };
  const btn = opButton(root, op);
  if (btn) return { kind: "button", choose: () => btn.click() };
  return undefined;
}

function calculateButton(root: HTMLElement): HTMLElement | undefined {
  const candidates = buttons(root).filter(
    (b) => !isSpecialButton(b) && !OPS.some((o) => matchesOp(labelText(b), o)),
  );
  return (
    candidates.find((b) => /calc|equal|compute|result|^\s*=\s*$/i.test(labelText(b))) ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

function setValue(input: HTMLInputElement, value: string): void {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

// Enters a and b, picks op and calculates, then returns the visible text.
async function calculate(root: HTMLElement, a: string, b: string, op: Op): Promise<string> {
  const inputs = operandInputs(root);
  expect(inputs, "expected exactly two number inputs").toHaveLength(2);
  setValue(inputs[0], a);
  setValue(inputs[1], b);
  const control = findOpControl(root, op);
  expect(control, `expected a way to choose "${op}"`).toBeDefined();
  control!.choose();
  const calc = calculateButton(root);
  if (calc) calc.click();
  else expect(control!.kind, "expected a calculate button").toBe("button");
  await settle();
  return visibleText(root);
}

function memoryButton(root: HTMLElement, key: MemoryKey): HTMLElement | undefined {
  return buttons(root).find((b) => isMemoryKey(b, key));
}

// Presses a memory key, which must be visible.
async function press(root: HTMLElement, key: MemoryKey): Promise<string> {
  const btn = memoryButton(root, key);
  expect(btn, `expected a visible '${MEMORY_KEY_NAMES[key]}' button`).toBeDefined();
  btn!.click();
  await settle();
  return visibleText(root);
}

// Presses a memory key if it's shown; a key may be hidden while it can't be
// used (e.g. M+ with no current result).
async function pressIfShown(root: HTMLElement, key: MemoryKey): Promise<string> {
  const btn = memoryButton(root, key);
  if (btn) {
    btn.click();
    await settle();
  }
  return visibleText(root);
}

// The value shown by the memory indicator (e.g. 'M: 9' or 'Memory: 9'), or
// undefined when no indicator is visible.
function memoryShown(root: HTMLElement): number | undefined {
  const text = visibleText(root).replace(/[−–]/g, "-");
  const m = /(?<![A-Za-z])M(?:emory)?\s*:\s*(-?\d+(?:\.\d+)?)(?![\d.])/i.exec(text);
  return m ? parseFloat(m[1]) : undefined;
}

function hasMemoryIndicator(root: HTMLElement): boolean {
  return /(?<![A-Za-z])M(?:emory)?\s*:/i.test(visibleText(root));
}

function expectMemory(root: HTMLElement, expected: number, context: string): void {
  const shown = memoryShown(root);
  expect(
    shown !== undefined && Math.abs(shown - expected) < 1e-9,
    `${context}: expected the memory indicator to show 'M: ${expected}', page showed: "${visibleText(root)}"`,
  ).toBe(true);
}

function expectNoMemoryIndicator(root: HTMLElement, context: string): void {
  expect(
    hasMemoryIndicator(root),
    `${context}: expected no memory indicator while memory is 0, page showed: "${visibleText(root)}"`,
  ).toBe(false);
}

function firstField(root: HTMLElement): HTMLInputElement {
  const inputs = operandInputs(root);
  expect(inputs, "expected exactly two number inputs").toHaveLength(2);
  return inputs[0];
}

function expectFirstField(root: HTMLElement, expected: number, context: string): void {
  const value = firstField(root).value.trim();
  expect(
    value !== "" && Math.abs(Number(value) - expected) < 1e-9,
    `${context}: expected the first number field to hold ${expected}, it held "${value}"`,
  ).toBe(true);
}

function historyToggle(root: HTMLElement): HTMLElement {
  const btn = buttons(root).find(isHistoryButton);
  expect(btn, "expected a visible 'History' button").toBeDefined();
  return btn!;
}

async function openHistory(root: HTMLElement): Promise<void> {
  if (storeControls(root).length === 0 && !/=/.test(visibleText(root))) {
    historyToggle(root).click();
    await settle();
  }
}

function storeControls(root: HTMLElement): HTMLElement[] {
  return buttons(root).filter(isStoreControl);
}

// The visible text of the history entry a 'Store in memory' control belongs
// to: its nearest ancestor that shows an entry ('a op b = result').
function entryOf(control: HTMLElement, root: HTMLElement): string {
  for (let node = control.parentElement; node && node !== root.parentElement; node = node.parentElement) {
    const text = visibleText(node);
    const count = (text.match(/=/g) ?? []).length;
    if (count === 0) continue;
    expect(count, `expected the 'Store in memory' control to belong to a single entry, found "${text}"`).toBe(1);
    return text;
  }
  throw new Error("expected the 'Store in memory' control to be part of a history entry");
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Finds the 'Store in memory' control of the entry ending in '= result' whose
// text starts with the operands a and b.
function storeControlFor(root: HTMLElement, a: string, b: string, result: string): HTMLElement {
  const re = new RegExp(
    `(?<![\\d.])${escape(a)}\\s*\\S\\s*${escape(b)}\\s*=\\s*${escape(result)}(?![\\d.])`,
  );
  const controls = storeControls(root);
  const control = controls.find((c) => re.test(entryOf(c, root).replace(/[−–]/g, "-")));
  expect(
    control,
    `expected a 'Store in memory' control for the entry '${a} … ${b} = ${result}', page showed: "${visibleText(root)}"`,
  ).toBeDefined();
  return control!;
}

describe("memory", () => {
  it("M+ adds and M− subtracts the current result; with no current result both leave memory unchanged", async () => {
    // Fresh page, no result shown: memory stays 0.
    const fresh = render();
    await pressIfShown(fresh, "plus");
    await pressIfShown(fresh, "minus");
    await calculate(fresh, "6", "3", "add");
    await press(fresh, "plus");
    expectMemory(fresh, 9, "after 6 + 3 then M+ on a page where M+/M− were pressed with no result");

    const root = render();
    await calculate(root, "6", "3", "add");
    await press(root, "plus");
    expectMemory(root, 9, "after 6 + 3 = 9 then M+");

    // Pressing M+ again adds the same result again.
    await press(root, "plus");
    expectMemory(root, 18, "after M+ a second time");

    // M− subtracts the new current result.
    await calculate(root, "8", "5", "subtract");
    await press(root, "minus");
    expectMemory(root, 15, "after 8 − 5 = 3 then M−");

    // Negative and decimal results.
    await calculate(root, "1", "3.5", "subtract");
    await press(root, "plus");
    expectMemory(root, 12.5, "after 1 − 3.5 = -2.5 then M+");
    await press(root, "minus");
    await press(root, "minus");
    expectMemory(root, 17.5, "after M− twice with -2.5");

    // After an error no result is shown, so M+ and M− change nothing.
    await calculate(root, "5", "0", "divide");
    await pressIfShown(root, "plus");
    await pressIfShown(root, "minus");
    await pressIfShown(root, "plus");
    expectMemory(root, 17.5, "after M+/M− with a 'Cannot divide by zero' error shown");

    // Likewise after a validation error.
    await calculate(root, "", "3", "add");
    await pressIfShown(root, "minus");
    await pressIfShown(root, "plus");
    await pressIfShown(root, "plus");
    expectMemory(root, 17.5, "after M+/M− with a validation error shown");

    // Once a result is shown again, M+ works again.
    await calculate(root, "2", "2", "multiply");
    await press(root, "plus");
    expectMemory(root, 21.5, "after 2 × 2 = 4 then M+");
  });

  it("MR puts the memory value into the first number field and MC sets memory back to 0", async () => {
    const root = render();
    await calculate(root, "6", "3", "multiply");
    await press(root, "plus");
    await calculate(root, "1", "3.5", "subtract");
    await press(root, "plus");
    expectMemory(root, 15.5, "after M+ with 18 and -2.5");

    // MR replaces whatever is in the first field with the memory value.
    setValue(firstField(root), "42");
    await press(root, "recall");
    expectFirstField(root, 15.5, "after MR with memory 15.5");
    expectMemory(root, 15.5, "MR leaves memory unchanged");

    // The recalled value can be used in a calculation.
    const second = operandInputs(root)[1];
    setValue(second, "0.5");
    findOpControl(root, "add")!.choose();
    calculateButton(root)!.click();
    await settle();
    expect(visibleText(root)).toMatch(/(?<![\d.])16(?![\d.])/);

    // A negative memory value is recalled too.
    await calculate(root, "0", "20", "add");
    await press(root, "minus");
    expectMemory(root, -4.5, "after M− with 20");
    setValue(firstField(root), "");
    await press(root, "recall");
    expectFirstField(root, -4.5, "after MR with memory -4.5");

    // MC sets memory back to 0.
    await press(root, "clear");
    expectNoMemoryIndicator(root, "after MC");
    setValue(firstField(root), "7");
    await press(root, "recall");
    expectFirstField(root, 0, "after MC then MR");

    // Memory starts again from 0 after MC.
    await calculate(root, "6", "3", "add");
    await press(root, "plus");
    expectMemory(root, 9, "after MC then 6 + 3 = 9 and M+");
  });

  it("shows a memory indicator with the value while memory isn't 0 and hides it while memory is 0", async () => {
    const root = render();
    expectNoMemoryIndicator(root, "on a fresh page");

    await calculate(root, "6", "3", "add");
    expectNoMemoryIndicator(root, "after a calculation without M+");
    await press(root, "plus");
    expectMemory(root, 9, "after 6 + 3 = 9 then M+");
    expect(visibleText(root)).toMatch(/(?<![A-Za-z])M(?:emory)?\s*:\s*9(?![\d.])/i);

    // The indicator stays while other calculations are made.
    await calculate(root, "2", "5", "multiply");
    expectMemory(root, 9, "after another calculation");

    // Back to 0 by subtracting: hidden.
    await calculate(root, "6", "3", "add");
    await press(root, "minus");
    expectNoMemoryIndicator(root, "after M− brings memory back to 0");

    // Negative memory is shown.
    await calculate(root, "1", "4", "subtract");
    await press(root, "minus");
    expectMemory(root, 3, "after M− with -3");
    await press(root, "minus");
    await press(root, "minus");
    expectMemory(root, 9, "after M− twice more with -3");
    await calculate(root, "4", "16", "subtract");
    await press(root, "plus");
    expectMemory(root, -3, "after M+ with -12");

    // MC hides it.
    await press(root, "clear");
    expectNoMemoryIndicator(root, "after MC");
  });

  it("each history entry has a 'Store in memory' control that sets memory to that entry's result", async () => {
    const root = render();
    await calculate(root, "6", "3", "multiply");
    await calculate(root, "8", "5", "subtract");
    await calculate(root, "1", "3.5", "subtract");
    await openHistory(root);

    expect(
      storeControls(root),
      `expected one 'Store in memory' control per history entry, page showed: "${visibleText(root)}"`,
    ).toHaveLength(3);

    // Storing sets memory to the entry's result.
    storeControlFor(root, "6", "3", "18").click();
    await settle();
    expectMemory(root, 18, "after 'Store in memory' on '6 × 3 = 18'");

    // Storing replaces memory rather than adding to it.
    storeControlFor(root, "8", "5", "3").click();
    await settle();
    expectMemory(root, 3, "after 'Store in memory' on '8 − 5 = 3'");

    storeControlFor(root, "1", "3.5", "-2.5").click();
    await settle();
    expectMemory(root, -2.5, "after 'Store in memory' on '1 − 3.5 = -2.5'");

    // Storing doesn't add history entries.
    expect(storeControls(root)).toHaveLength(3);

    // The stored value works with the memory keys.
    await calculate(root, "2", "2", "add");
    await press(root, "plus");
    expectMemory(root, 1.5, "after storing -2.5 then M+ with 4");
    await press(root, "recall");
    expectFirstField(root, 1.5, "after MR");

    // New entries get a control too, and storing an older entry still works.
    expect(storeControls(root)).toHaveLength(4);
    storeControlFor(root, "2", "2", "4").click();
    await settle();
    expectMemory(root, 4, "after 'Store in memory' on '2 + 2 = 4'");
    storeControlFor(root, "6", "3", "18").click();
    await settle();
    expectMemory(root, 18, "after 'Store in memory' on '6 × 3 = 18' again");

    // Storing a 0 result sets memory to 0, which hides the indicator.
    await calculate(root, "3", "3", "subtract");
    storeControlFor(root, "3", "3", "0").click();
    await settle();
    expectNoMemoryIndicator(root, "after 'Store in memory' on '3 − 3 = 0'");
  });

  it("adds no new editable inputs", async () => {
    const editable = (root: HTMLElement): Element[] =>
      Array.from(root.querySelectorAll("input, textarea, [contenteditable]")).filter((el) => {
        if (el instanceof HTMLInputElement) {
          return !NON_OPERAND_TYPES.has(el.type) && !el.readOnly && !el.disabled;
        }
        if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
        return el.getAttribute("contenteditable") !== "false";
      });
    const selects = (root: HTMLElement): number => root.querySelectorAll("select").length;

    const root = render();
    expect(editable(root), "expected only the two number fields to be editable").toHaveLength(2);
    expect(selects(root)).toBe(1);

    // Still only the two number fields after using memory and history.
    await calculate(root, "6", "3", "add");
    await press(root, "plus");
    await press(root, "recall");
    await openHistory(root);
    storeControlFor(root, "6", "3", "9").click();
    await settle();
    await press(root, "clear");
    expect(editable(root), "expected only the two number fields to be editable").toHaveLength(2);
    expect(operandInputs(root)).toHaveLength(2);
    expect(selects(root)).toBe(1);
  });
});
