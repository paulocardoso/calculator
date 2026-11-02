import { afterEach, describe, expect, it } from "vitest";
import { mount } from "../src/app";

// Acceptance tests for the 'Power' and 'Root' operations. Like the other
// tests, they drive the calculator the way a user would: controls are found
// by what the user sees (input fields, option/radio/button labels) and
// assertions are made on the page's visible text. They don't rely on ids,
// classes or test ids.

type Op = "add" | "subtract" | "multiply" | "divide" | "power" | "root";

const OP_PATTERNS: Record<Op, RegExp> = {
  add: /add|plus|sum|^\s*\+\s*$/i,
  subtract: /subtract|minus|difference|^\s*[-−–]\s*$/i,
  multiply: /multipl|times|product|^\s*[×*✕x]\s*$/i,
  divide: /divi|quotient|^\s*[÷/]\s*$/i,
  power: /power|exponent|^\s*(\^|\*\*|xʸ|x\^y|aᵇ|a\^b)\s*$/i,
  root: /root|√/i,
};
const OPS: Op[] = ["add", "subtract", "multiply", "divide", "power", "root"];

// The symbol a history entry uses for each operation (e.g. '2 ^ 10 = 1024').
const OP_SYMBOLS: Record<Op, string> = {
  add: "\\+",
  subtract: "[-−–]",
  multiply: "[×✕*x]",
  divide: "[÷/]",
  power: "\\^",
  root: "√",
};

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

function numbersIn(text: string): number[] {
  const normalized = text.replace(/[−–]/g, "-");
  const matches = normalized.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|-?\.\d+/gi) ?? [];
  return matches.map((m) => parseFloat(m));
}

// Items in `after` that weren't already in `before` (multiset difference).
function added<T>(before: T[], after: T[]): T[] {
  const remaining = [...before];
  const result: T[] = [];
  for (const item of after) {
    const i = remaining.indexOf(item);
    if (i >= 0) remaining.splice(i, 1);
    else result.push(item);
  }
  return result;
}

function operandInputs(root: HTMLElement): HTMLInputElement[] {
  return Array.from(root.querySelectorAll("input")).filter(
    (i) => !NON_OPERAND_TYPES.has(i.type) && !i.readOnly && !i.disabled && !isHidden(i),
  );
}

function labelText(el: HTMLElement): string {
  const parts: string[] = [];
  if (el instanceof HTMLInputElement) {
    parts.push(el.value);
    for (const l of Array.from(el.labels ?? [])) parts.push(l.textContent ?? "");
  } else {
    parts.push(el.textContent ?? "");
  }
  parts.push(el.getAttribute("aria-label") ?? "");
  parts.push(el.getAttribute("title") ?? "");
  return parts.join(" ").trim();
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
  ).filter((b) => !isHidden(b));
}

function isHistoryButton(b: HTMLElement): boolean {
  return /history/i.test(labelText(b));
}

function opButton(root: HTMLElement, op: Op): HTMLElement | undefined {
  return buttons(root).find((b) => {
    if (isHistoryButton(b)) return false;
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
    (b) => !isHistoryButton(b) && !OPS.some((o) => matchesOp(labelText(b), o)),
  );
  return (
    candidates.find((b) => /calc|equal|compute|result|^\s*=\s*$/i.test(labelText(b))) ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

function historyButton(root: HTMLElement): HTMLElement {
  const btn = buttons(root).find(isHistoryButton);
  expect(btn, "expected a visible 'History' button").toBeDefined();
  return btn!;
}

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

async function toggleHistory(root: HTMLElement): Promise<string> {
  historyButton(root).click();
  await settle();
  return visibleText(root);
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

// Renders a fresh page, calculates, and returns the page text and the numbers
// that appeared on it as a result (compared with the freshly rendered page).
async function freshResult(
  a: string,
  b: string,
  op: Op,
): Promise<{ root: HTMLElement; text: string; newNumbers: number[] }> {
  const root = render();
  const before = visibleText(root);
  const text = await calculate(root, a, b, op);
  return { root, text, newNumbers: added(numbersIn(before), numbersIn(text)) };
}

// Checks that exactly `expected` is shown as the result: it appears on the
// page (without floating point noise such as 3.0000000000000004) and no other
// new number besides the operands does.
function expectShowsExactly(
  newNumbers: number[],
  expected: number,
  inputs: number[],
  text: string,
): void {
  expect(
    newNumbers.includes(expected),
    `expected the result ${expected} to be shown, page showed: "${text}"`,
  ).toBe(true);
  const unexpected = newNumbers.filter((n) => n !== expected && !inputs.includes(n));
  expect(unexpected, `expected only the result ${expected}, page showed: "${text}"`).toEqual([]);
}

function expectNoResult(newNumbers: number[], inputs: number[], text: string): void {
  const unexpected = newNumbers.filter((n) => !inputs.includes(n));
  expect(unexpected, `expected no result to be shown, page showed: "${text}"`).toEqual([]);
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches a history entry like '6 × 3 = 18'.
function entryPattern(a: string, op: Op, b: string, result: string): RegExp {
  return new RegExp(
    `(?<![\\d.])${escape(a)}\\s*${OP_SYMBOLS[op]}\\s*${escape(b)}\\s*=\\s*${escape(result)}(?![\\d.])`,
  );
}

function entryIndex(text: string, a: string, op: Op, b: string, result: string): number {
  const m = entryPattern(a, op, b, result).exec(text);
  return m ? m.index : -1;
}

// Every history entry shows 'a op b = result', so the number of '=' signs on
// the page (which has none without history entries) counts the entries.
function entryCount(text: string): number {
  return (text.match(/=/g) ?? []).length;
}

const NOT_A_NUMBER = /infinity|nan|∞/i;

describe("power and root", () => {
  it("Power with 2 and 10 shows 1024 and adds '2 ^ 10 = 1024' at the top of the history", async () => {
    const { text, newNumbers } = await freshResult("2", "10", "power");
    expectShowsExactly(newNumbers, 1024, [2, 10], text);

    const root = render();
    await calculate(root, "6", "3", "multiply");
    let shown = await calculate(root, "2", "10", "power");
    expect(shown).toContain("1024");

    shown = await toggleHistory(root);
    expect(shown, `expected the entry '2 ^ 10 = 1024', page showed: "${shown}"`).toMatch(
      /(?<![\d.])2 \^ 10 = 1024(?![\d.])/,
    );
    const powerAt = entryIndex(shown, "2", "power", "10", "1024");
    const multiplyAt = entryIndex(shown, "6", "multiply", "3", "18");
    expect(multiplyAt, `expected the earlier entry '6 × 3 = 18', page showed: "${shown}"`).toBeGreaterThanOrEqual(0);
    expect(powerAt, "expected '2 ^ 10 = 1024' at the top of the history").toBeLessThan(multiplyAt);
    expect(entryCount(shown)).toBe(2);

    // Calculating while the panel is open puts the new entry at the top too.
    shown = await calculate(root, "3", "2", "power");
    expect(entryIndex(shown, "3", "power", "2", "9")).toBeGreaterThanOrEqual(0);
    expect(entryIndex(shown, "3", "power", "2", "9")).toBeLessThan(
      entryIndex(shown, "2", "power", "10", "1024"),
    );
    expect(entryCount(shown)).toBe(3);
  });

  it("Root with 27 and 3 shows 3, and with -8 and 3 shows -2", async () => {
    const cube = await freshResult("27", "3", "root");
    expectShowsExactly(cube.newNumbers, 3, [27], cube.text);
    expect(cube.text).not.toMatch(/3\.0000|2\.9999/);

    const negative = await freshResult("-8", "3", "root");
    expectShowsExactly(negative.newNumbers, -2, [-8, 3], negative.text);
    expect(negative.text).not.toMatch(NOT_A_NUMBER);
    expect(negative.text).not.toMatch(/2\.0000|1\.9999/);

    // On the same page, the result updates between calculations.
    const root = render();
    expect(await calculate(root, "27", "3", "root")).toMatch(/(?<![\d.\-−])3(?![\d.])/);
    const text = await calculate(root, "-8", "3", "root");
    expect(text.replace(/[−–]/g, "-")).toMatch(/-2(?![\d.])/);
  });

  it("shows an error, no result and no history entry for an even root of a negative number or a root degree of 0", async () => {
    const evenRoot: [string, string][] = [
      ["-16", "2"],
      ["-16", "4"],
    ];
    for (const [a, b] of evenRoot) {
      const { root, text, newNumbers } = await freshResult(a, b, "root");
      expect(text.toLowerCase(), `for ${a} and ${b}, page showed: "${text}"`).toContain(
        "cannot take an even root of a negative number",
      );
      expect(text).not.toMatch(NOT_A_NUMBER);
      expectNoResult(newNumbers, [Number(a), Number(b)], text);
      const withHistory = await toggleHistory(root);
      expect(entryCount(withHistory), `expected no history entry, page showed: "${withHistory}"`).toBe(0);
    }

    for (const a of ["8", "-8", "0"]) {
      const { root, text, newNumbers } = await freshResult(a, "0", "root");
      expect(text.toLowerCase(), `for ${a} and 0, page showed: "${text}"`).toContain(
        "root degree cannot be zero",
      );
      expect(text).not.toMatch(NOT_A_NUMBER);
      expectNoResult(newNumbers, [Number(a), 0], text);
      const withHistory = await toggleHistory(root);
      expect(entryCount(withHistory), `expected no history entry, page showed: "${withHistory}"`).toBe(0);
    }

    // After a successful calculation, the errors replace its result and add
    // nothing to the history.
    const root = render();
    expect(await calculate(root, "6", "3", "multiply")).toContain("18");
    let text = await calculate(root, "-16", "2", "root");
    expect(text.toLowerCase()).toContain("cannot take an even root of a negative number");
    expect(text).not.toContain("18");
    text = await calculate(root, "8", "0", "root");
    expect(text.toLowerCase()).toContain("root degree cannot be zero");
    expect(text).not.toContain("18");
    text = await toggleHistory(root);
    expect(entryIndex(text, "6", "multiply", "3", "18")).toBeGreaterThanOrEqual(0);
    expect(entryCount(text), `expected exactly one history entry, page showed: "${text}"`).toBe(1);
  });

  it("Power with 10 and 400 shows 'Result is too large to show', adds no history entry, and never shows Infinity or NaN", async () => {
    const { root, text, newNumbers } = await freshResult("10", "400", "power");
    expect(text.toLowerCase(), `page showed: "${text}"`).toContain("result is too large to show");
    expect(text).not.toMatch(NOT_A_NUMBER);
    expectNoResult(newNumbers, [10, 400], text);
    let withHistory = await toggleHistory(root);
    expect(entryCount(withHistory), `expected no history entry, page showed: "${withHistory}"`).toBe(0);
    expect(withHistory).not.toMatch(NOT_A_NUMBER);

    // With the history open and an earlier entry, nothing is added.
    withHistory = await calculate(root, "2", "10", "power");
    expect(entryCount(withHistory)).toBe(1);
    withHistory = await calculate(root, "10", "400", "power");
    expect(withHistory.toLowerCase()).toContain("result is too large to show");
    expect(entryCount(withHistory)).toBe(1);
    expect(withHistory).not.toMatch(NOT_A_NUMBER);

    // Other inputs whose mathematical result isn't a finite number never show
    // Infinity or NaN, neither as the result nor in the history.
    const tricky: [string, string, Op][] = [
      ["0", "-1", "power"],
      ["-8", "0.5", "power"],
      ["10", "0.001", "root"],
      ["-8", "0.5", "root"],
    ];
    for (const [a, b, op] of tricky) {
      const page = render();
      const shown = await calculate(page, a, b, op);
      expect(shown, `${op} with ${a} and ${b} showed: "${shown}"`).not.toMatch(NOT_A_NUMBER);
      const history = await toggleHistory(page);
      expect(history, `${op} with ${a} and ${b} showed: "${history}"`).not.toMatch(NOT_A_NUMBER);
    }
  });

  it("keeps add, subtract, multiply, divide, input validation and history working alongside Power and Root", async () => {
    const root = render();
    for (const op of OPS) {
      expect(findOpControl(root, op), `expected a way to choose "${op}"`).toBeDefined();
    }

    const cases: [Op, number][] = [
      ["add", 9],
      ["subtract", 3],
      ["multiply", 18],
      ["divide", 2],
    ];
    for (const [op, expected] of cases) {
      const { text, newNumbers } = await freshResult("6", "3", op);
      expectShowsExactly(newNumbers, expected, [6, 3], text);
    }

    // Mixing operations on one page: each shows its own result.
    let text = await calculate(root, "2", "10", "power");
    expect(text).toContain("1024");
    text = await calculate(root, "6", "3", "add");
    expect(text).toContain("9");
    expect(text).not.toContain("1024");
    text = await calculate(root, "5", "0", "divide");
    expect(text.toLowerCase()).toContain("cannot divide by zero");
    text = await calculate(root, "", "3", "power");
    expect(text.toLowerCase()).toMatch(/valid number/);
    expect(text).not.toMatch(NOT_A_NUMBER);
    text = await calculate(root, "abc", "3", "root");
    expect(text.toLowerCase()).toMatch(/valid number/);
    expect(text).not.toMatch(NOT_A_NUMBER);
    text = await calculate(root, "6", "3", "multiply");
    expect(text).toContain("18");

    // History lists the successful calculations, newest first.
    text = await toggleHistory(root);
    const multiplyAt = entryIndex(text, "6", "multiply", "3", "18");
    const addAt = entryIndex(text, "6", "add", "3", "9");
    const powerAt = entryIndex(text, "2", "power", "10", "1024");
    expect(multiplyAt, `page showed: "${text}"`).toBeGreaterThanOrEqual(0);
    expect(multiplyAt).toBeLessThan(addAt);
    expect(addAt).toBeLessThan(powerAt);
    expect(entryCount(text)).toBe(3);
  });
});
