import { afterEach, describe, expect, it } from "vitest";
import { mount } from "../src/app";

// These tests drive the calculator the way a user would: they find the two
// number fields, the operation choice and the calculate control by what the
// user sees (input fields, option/radio/button labels, button text), and then
// read the page's visible text. They don't rely on ids, classes or test ids.

type Op = "add" | "subtract" | "multiply" | "divide";

const OP_PATTERNS: Record<Op, RegExp> = {
  add: /add|plus|sum|^\s*\+\s*$/i,
  subtract: /subtract|minus|difference|^\s*[-−–]\s*$/i,
  multiply: /multipl|times|product|^\s*[×*✕x]\s*$/i,
  divide: /divi|quotient|^\s*[÷/]\s*$/i,
};
const OPS: Op[] = ["add", "subtract", "multiply", "divide"];

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
// fields (which some UIs use to display a result).
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
  const matches = normalized.match(/-?\d+(?:\.\d+)?|-?\.\d+/g) ?? [];
  return matches.map((m) => parseFloat(m));
}

function wordsIn(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9.\-]+/i)
    .filter((w) => w.length > 0);
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

function opButton(root: HTMLElement, op: Op): HTMLElement | undefined {
  return buttons(root).find((b) => {
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
  const candidates = buttons(root).filter((b) => !OPS.some((o) => matchesOp(labelText(b), o)));
  return (
    candidates.find((b) => /calc|equal|compute|result|^\s*=\s*$/i.test(labelText(b))) ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

function setValue(input: HTMLInputElement, value: string): void {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
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

// Renders a fresh page, calculates, and returns the numbers and words that
// appeared on the page as a result (compared with the freshly rendered page).
async function freshResult(
  a: string,
  b: string,
  op: Op,
): Promise<{ text: string; newNumbers: number[]; newWords: string[] }> {
  const root = render();
  const before = visibleText(root);
  const text = await calculate(root, a, b, op);
  return {
    text,
    newNumbers: added(numbersIn(before), numbersIn(text)),
    newWords: added(wordsIn(before), wordsIn(text)),
  };
}

function expectShowsNumber(newNumbers: number[], expected: number): void {
  expect(
    newNumbers.some((n) => Math.abs(n - expected) < 1e-9),
    `expected the result ${expected} to be shown, but new numbers on the page were [${newNumbers.join(", ")}]`,
  ).toBe(true);
}

const VALIDATION_WORDS =
  /invalid|valid|error|enter|required|missing|please|number|numeric|empty|must|provide/i;

describe("calculator", () => {
  it("shows two number inputs, an operation choice and a way to calculate", () => {
    const root = render();
    expect(operandInputs(root)).toHaveLength(2);
    const controls = OPS.map((op) => findOpControl(root, op));
    for (const [i, c] of controls.entries()) {
      expect(c, `expected a way to choose "${OPS[i]}"`).toBeDefined();
    }
    const hasCalculate =
      calculateButton(root) !== undefined || controls.every((c) => c?.kind === "button");
    expect(hasCalculate, "expected a calculate button").toBe(true);
  });

  it("shows 9, 3, 18 and 2 for 6 and 3 with add, subtract, multiply and divide", async () => {
    const cases: [Op, number][] = [
      ["add", 9],
      ["subtract", 3],
      ["multiply", 18],
      ["divide", 2],
    ];
    for (const [op, expected] of cases) {
      const { newNumbers } = await freshResult("6", "3", op);
      expectShowsNumber(newNumbers, expected);
    }
    // The page also updates when the operation changes on the same page.
    const root = render();
    const multiplied = await calculate(root, "6", "3", "multiply");
    expect(multiplied).toContain("18");
    const divided = await calculate(root, "6", "3", "divide");
    expect(divided).not.toContain("18");
  });

  it("handles decimal and negative inputs: -1.5 + 2 shows 0.5", async () => {
    const { newNumbers } = await freshResult("-1.5", "2", "add");
    expectShowsNumber(newNumbers, 0.5);
  });

  it("shows 'Cannot divide by zero' instead of a result when dividing by 0", async () => {
    for (const a of ["5", "-2.5", "0"]) {
      const { text, newNumbers } = await freshResult(a, "0", "divide");
      expect(text.toLowerCase()).toContain("cannot divide by zero");
      expect(text).not.toMatch(/infinity|nan|∞/i);
      const inputs = [parseFloat(a), 0];
      const unexpected = newNumbers.filter((n) => !inputs.includes(n));
      expect(unexpected, "expected no result to be shown").toEqual([]);
    }
    // A previous result is replaced by the error.
    const root = render();
    expect(await calculate(root, "6", "3", "add")).toContain("9");
    const text = await calculate(root, "6", "0", "divide");
    expect(text.toLowerCase()).toContain("cannot divide by zero");
    expect(text).not.toMatch(/(^|[^\d.])9(?![\d]|\.\d)/);
    expect(text).not.toMatch(/infinity|∞/i);
  });

  it("shows a validation error and no result when an input is empty or not a number", async () => {
    const bad: [string, string][] = [
      ["", "3"],
      ["6", ""],
      ["", ""],
      ["abc", "3"],
      ["6", "abc"],
    ];
    for (const [a, b] of bad) {
      for (const op of ["add", "multiply"] as Op[]) {
        const { text, newNumbers, newWords } = await freshResult(a, b, op);
        expect(
          newWords.some((w) => VALIDATION_WORDS.test(w)),
          `expected a validation error for inputs "${a}" and "${b}", page showed: "${text}"`,
        ).toBe(true);
        expect(text).not.toMatch(/nan|infinity/i);
        const inputNumbers = [a, b].filter((v) => v !== "" && !isNaN(Number(v))).map(Number);
        const unexpected = newNumbers.filter((n) => !inputNumbers.includes(n));
        expect(unexpected, `expected no result for inputs "${a}" and "${b}"`).toEqual([]);
      }
    }
    // A previous result is cleared when the input becomes invalid.
    const root = render();
    expect(await calculate(root, "6", "3", "multiply")).toContain("18");
    const text = await calculate(root, "", "3", "multiply");
    expect(text).not.toContain("18");
    expect(text).not.toMatch(/nan/i);
  });
});
