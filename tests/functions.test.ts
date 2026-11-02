import { afterEach, describe, expect, it } from "vitest";
import { mount } from "../src/app";

// Acceptance tests for the single-number scientific functions (Square root,
// Sine, Cosine, Tangent, Log (base 10) and Natural log). Like the other
// tests, they drive the calculator the way a user would: controls are found
// by what the user sees (input fields, option/radio/button labels) and
// assertions are made on the page's visible text. They don't rely on ids,
// classes or test ids.

type Fn = "sqrt" | "sin" | "cos" | "tan" | "log" | "ln";
type TwoOp = "add" | "multiply" | "power";
type AnyOp = Fn | TwoOp;

const FNS: Fn[] = ["sqrt", "sin", "cos", "tan", "log", "ln"];
const FN_NAMES: Record<Fn, string> = {
  sqrt: "Square root",
  sin: "Sine",
  cos: "Cosine",
  tan: "Tangent",
  log: "Log (base 10)",
  ln: "Natural log",
};

const IS_LN = /natural|(^|[^a-z])ln([^a-z]|$)/i;

// Whether a control's label (option value and text, or button/radio label)
// names the operation.
const MATCHERS: Record<AnyOp, (s: string) => boolean> = {
  sqrt: (s) => /square\s*root|sqrt|^\s*√\s*x?\s*$/i.test(s),
  sin: (s) => /(^|[^a-z])sin(e)?([^a-z]|$)/i.test(s),
  cos: (s) => /(^|[^a-z])cos(ine)?([^a-z]|$)/i.test(s),
  tan: (s) => /(^|[^a-z])tan(gent)?([^a-z]|$)/i.test(s),
  log: (s) => /log/i.test(s) && !IS_LN.test(s),
  ln: (s) => IS_LN.test(s),
  add: (s) => /(^|[^a-z])(add|plus|sum)|^\s*\+\s*$/i.test(s),
  multiply: (s) => /multipl|times|product|^\s*[×*✕x]\s*$/i.test(s),
  power: (s) => /power|exponent|^\s*(\^|\*\*|xʸ|x\^y|aᵇ|a\^b)\s*$/i.test(s),
};
const ALL_OPS: AnyOp[] = [...FNS, "add", "multiply", "power"];

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

const NOT_A_NUMBER = /infinity|nan|∞/i;
const VALIDATION_WORDS =
  /invalid|valid|error|enter|required|missing|please|number|numeric|empty|must|provide/i;

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

// Whether el and all its ancestors are shown.
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

function numbersIn(text: string): number[] {
  const normalized = text.replace(/[−–]/g, "-");
  const matches = normalized.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|-?\.\d+/gi) ?? [];
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

// All number fields the user could type into, in page order, whether shown or not.
function allOperandInputs(root: HTMLElement): HTMLInputElement[] {
  return Array.from(root.querySelectorAll("input")).filter(
    (i) => !NON_OPERAND_TYPES.has(i.type) && !i.readOnly && !i.disabled,
  );
}

// The number fields currently shown to the user.
function visibleOperandInputs(root: HTMLElement): HTMLInputElement[] {
  return allOperandInputs(root).filter(isVisible);
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

function buttons(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, input[type="submit"], input[type="button"], [role="button"]',
    ),
  ).filter(isVisible);
}

function isHistoryButton(b: HTMLElement): boolean {
  return /history/i.test(labelText(b));
}

function isOpLabel(text: string): boolean {
  return ALL_OPS.some((o) => MATCHERS[o](text));
}

interface OpControl {
  kind: "select" | "radio" | "button";
  element: HTMLElement;
  choose: () => void;
}

function findOpControl(root: HTMLElement, op: AnyOp): OpControl | undefined {
  for (const select of Array.from(root.querySelectorAll("select"))) {
    const option = Array.from(select.options).find((o) =>
      MATCHERS[op](`${o.value} ${o.textContent ?? ""} ${o.getAttribute("aria-label") ?? ""}`),
    );
    if (option) {
      return {
        kind: "select",
        element: option,
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
    (r) => MATCHERS[op](labelText(r)),
  );
  if (radio) return { kind: "radio", element: radio, choose: () => radio.click() };
  const btn = buttons(root).find((b) => !isHistoryButton(b) && MATCHERS[op](labelText(b)));
  if (btn) return { kind: "button", element: btn, choose: () => btn.click() };
  return undefined;
}

function calculateButton(root: HTMLElement): HTMLElement | undefined {
  const candidates = buttons(root).filter(
    (b) => !isHistoryButton(b) && !isOpLabel(labelText(b)),
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

async function choose(root: HTMLElement, op: AnyOp): Promise<OpControl> {
  const control = findOpControl(root, op);
  expect(control, `expected a way to choose "${op}"`).toBeDefined();
  control!.choose();
  await settle();
  return control!;
}

function clickCalculate(root: HTMLElement, control: OpControl): void {
  const calc = calculateButton(root);
  if (calc) calc.click();
  else expect(control.kind, "expected a calculate button").toBe("button");
}

// Picks a single-number function, enters a in the (only) number field shown
// and calculates, then returns the visible text.
async function calcFn(root: HTMLElement, fn: Fn, a: string): Promise<string> {
  const control = await choose(root, fn);
  const inputs = visibleOperandInputs(root);
  expect(inputs, `expected exactly one number field for ${FN_NAMES[fn]}`).toHaveLength(1);
  expect(inputs[0], "expected the first number field to be the one shown").toBe(
    allOperandInputs(root)[0],
  );
  setValue(inputs[0], a);
  clickCalculate(root, control);
  await settle();
  return visibleText(root);
}

// Picks a two-number operation, enters a and b and calculates, then returns
// the visible text.
async function calcTwo(root: HTMLElement, op: TwoOp, a: string, b: string): Promise<string> {
  const control = await choose(root, op);
  const inputs = visibleOperandInputs(root);
  expect(inputs, `expected two number fields for ${op}`).toHaveLength(2);
  setValue(inputs[0], a);
  setValue(inputs[1], b);
  clickCalculate(root, control);
  await settle();
  return visibleText(root);
}

// Renders a fresh page, runs fn on a, and returns the page text and the
// numbers and words that appeared on it (compared with the fresh page).
async function freshFn(
  fn: Fn,
  a: string,
): Promise<{ root: HTMLElement; text: string; newNumbers: number[]; newWords: string[] }> {
  const root = render();
  const before = visibleText(root);
  const text = await calcFn(root, fn, a);
  return {
    root,
    text,
    newNumbers: added(numbersIn(before), numbersIn(text)),
    newWords: added(wordsIn(before), wordsIn(text)),
  };
}

// Every history entry shows '... = result', so the number of '=' signs on the
// page (which has none without history entries) counts the entries.
function entryCount(text: string): number {
  return (text.match(/=/g) ?? []).length;
}

function indexOf(text: string, pattern: RegExp): number {
  const m = pattern.exec(text);
  return m ? m.index : -1;
}

describe("single-number functions", () => {
  it("offers Square root, Sine, Cosine, Tangent, Log (base 10) and Natural log, hiding the second number field for them and showing it again for two-number operations", async () => {
    const root = render();
    const fields = allOperandInputs(root);
    expect(fields, "expected two number fields").toHaveLength(2);
    const [first, second] = fields;
    expect(visibleOperandInputs(root), "expected both number fields shown at first").toHaveLength(2);

    // Each function is its own, separate choice.
    const controls = FNS.map((fn) => findOpControl(root, fn));
    for (const [i, c] of controls.entries()) {
      expect(c, `expected a way to choose "${FN_NAMES[FNS[i]]}"`).toBeDefined();
    }
    const elements = new Set(controls.map((c) => c!.element));
    expect(elements.size, "expected six distinct function choices").toBe(6);

    const expectSecondHidden = (what: string): void => {
      expect(isVisible(second), `expected the second number field hidden for ${what}`).toBe(false);
      for (const label of Array.from(second.labels ?? [])) {
        expect(isVisible(label), `expected the second number field's label hidden for ${what}`).toBe(
          false,
        );
      }
      expect(isVisible(first), `expected the first number field shown for ${what}`).toBe(true);
      expect(visibleOperandInputs(root)).toEqual([first]);
    };
    const expectSecondShown = (what: string): void => {
      expect(isVisible(first), `expected the first number field shown for ${what}`).toBe(true);
      expect(isVisible(second), `expected the second number field shown for ${what}`).toBe(true);
      expect(visibleOperandInputs(root)).toEqual([first, second]);
    };

    for (const fn of FNS) {
      await choose(root, "add");
      expectSecondShown("Add");
      await choose(root, fn);
      expectSecondHidden(FN_NAMES[fn]);
      await choose(root, "add");
      expectSecondShown(`Add after ${FN_NAMES[fn]}`);
    }

    // Switching between functions keeps it hidden; other two-number
    // operations show it again.
    await choose(root, "sin");
    await choose(root, "ln");
    expectSecondHidden("Natural log after Sine");
    await choose(root, "multiply");
    expectSecondShown("Multiply");
    await choose(root, "sqrt");
    expectSecondHidden("Square root");
    await choose(root, "power");
    expectSecondShown("Power");
  });

  it("shows 4 for Square root of 16, 3 for Log of 1000, 0 for Natural log of 1, and 0.5, 0.5 and 1 for Sine 30, Cosine 60 and Tangent 45 (degrees)", async () => {
    const cases: [Fn, string, number, number[]][] = [
      ["sqrt", "16", 4, [16]],
      ["log", "1000", 3, [1000, 10]],
      ["ln", "1", 0, [1]],
      ["sin", "30", 0.5, [30]],
      ["cos", "60", 0.5, [60]],
      ["tan", "45", 1, [45]],
    ];
    for (const [fn, a, expected, allowed] of cases) {
      const { text, newNumbers } = await freshFn(fn, a);
      expect(
        newNumbers.includes(expected),
        `expected ${FN_NAMES[fn]} of ${a} to show ${expected}, page showed: "${text}"`,
      ).toBe(true);
      const unexpected = newNumbers.filter((n) => n !== expected && !allowed.includes(n));
      expect(
        unexpected,
        `expected only the result ${expected} for ${FN_NAMES[fn]} of ${a}, page showed: "${text}"`,
      ).toEqual([]);
      expect(text).not.toMatch(NOT_A_NUMBER);
      expect(text).not.toMatch(/0\.4999|0\.5000|0\.9999|1\.0000|2\.9999|3\.0000/);
      expect(text.toLowerCase()).not.toMatch(/valid number|error/);
    }

    // On one page, switching between functions and two-number operations
    // updates the result each time.
    const root = render();
    let text = await calcFn(root, "sqrt", "16");
    expect(text).toMatch(/(?<![\d.])4(?![\d.])/);
    text = await calcTwo(root, "multiply", "6", "3");
    expect(text).toMatch(/(?<![\d.])18(?![\d.])/);
    text = await calcFn(root, "tan", "45");
    expect(text).toMatch(/(?<![\d.])1(?![\d.])/);
    expect(text).not.toMatch(/(?<![\d.])18(?![\d.])/);
    text = await calcFn(root, "cos", "60");
    expect(text).toMatch(/(?<![\d.])0\.5(?![\d.])/);
  });

  it("shows an error, no result and no history entry for the square root of a negative number, the log of 0 or a negative number, and the tangent of 90 or 270", async () => {
    const cases: [Fn, string, string][] = [
      ["sqrt", "-4", "Cannot take the square root of a negative number"],
      ["sqrt", "-0.25", "Cannot take the square root of a negative number"],
      ["log", "0", "Logarithm needs a positive number"],
      ["log", "-10", "Logarithm needs a positive number"],
      ["ln", "0", "Logarithm needs a positive number"],
      ["ln", "-1", "Logarithm needs a positive number"],
      ["tan", "90", "Tangent is undefined for this angle"],
      ["tan", "270", "Tangent is undefined for this angle"],
    ];
    for (const [fn, a, message] of cases) {
      const { root, text, newNumbers } = await freshFn(fn, a);
      expect(text.toLowerCase(), `${FN_NAMES[fn]} of ${a}, page showed: "${text}"`).toContain(
        message.toLowerCase(),
      );
      expect(text).not.toMatch(NOT_A_NUMBER);
      const unexpected = newNumbers.filter((n) => n !== Number(a) && n !== 10);
      expect(unexpected, `expected no result for ${FN_NAMES[fn]} of ${a}, page showed: "${text}"`).toEqual(
        [],
      );
      const withHistory = await toggleHistory(root);
      expect(
        entryCount(withHistory),
        `expected no history entry for ${FN_NAMES[fn]} of ${a}, page showed: "${withHistory}"`,
      ).toBe(0);
    }

    // After a successful calculation, each error replaces its result and adds
    // nothing to the history (with the panel open as well).
    const root = render();
    let text = await calcTwo(root, "multiply", "6", "3");
    expect(text).toContain("18");
    for (const [fn, a, message] of cases) {
      text = await calcFn(root, fn, a);
      expect(text.toLowerCase(), `${FN_NAMES[fn]} of ${a}, page showed: "${text}"`).toContain(
        message.toLowerCase(),
      );
      expect(text).not.toMatch(/(?<![\d.])18(?![\d.])/);
    }
    text = await toggleHistory(root);
    expect(entryCount(text), `expected exactly one history entry, page showed: "${text}"`).toBe(1);
    text = await calcFn(root, "tan", "90");
    expect(text.toLowerCase()).toContain("tangent is undefined for this angle");
    text = await calcFn(root, "sqrt", "-9");
    expect(text.toLowerCase()).toContain("cannot take the square root of a negative number");
    expect(entryCount(text), `expected exactly one history entry, page showed: "${text}"`).toBe(1);
    expect(text).not.toMatch(NOT_A_NUMBER);
  });

  it("shows a validation error and no result when the first field is empty or not a number for a single-number function", async () => {
    for (const fn of FNS) {
      for (const a of ["", "   ", "abc"]) {
        const { root, text, newNumbers, newWords } = await freshFn(fn, a);
        expect(
          newWords.some((w) => VALIDATION_WORDS.test(w)),
          `expected a validation error for ${FN_NAMES[fn]} of "${a}", page showed: "${text}"`,
        ).toBe(true);
        expect(text).not.toMatch(NOT_A_NUMBER);
        expect(newNumbers, `expected no result for ${FN_NAMES[fn]} of "${a}", page showed: "${text}"`).toEqual(
          [],
        );
        const withHistory = await toggleHistory(root);
        expect(entryCount(withHistory)).toBe(0);
      }
    }

    // A previous result is cleared when the first field becomes invalid.
    const root = render();
    let text = await calcFn(root, "sqrt", "16");
    expect(text).toMatch(/(?<![\d.])4(?![\d.])/);
    text = await calcFn(root, "sqrt", "");
    expect(text.toLowerCase()).toMatch(VALIDATION_WORDS);
    expect(text).not.toMatch(/(?<![\d.])4(?![\d.])/);
    expect(text).not.toMatch(NOT_A_NUMBER);
  });

  it("adds a history entry at the top for each successful single-number calculation, showing the function, its input and the formatted result", async () => {
    const root = render();
    await calcTwo(root, "multiply", "6", "3");
    await calcFn(root, "sqrt", "16");

    let text = await toggleHistory(root);
    const sqrtEntry = /√\s*16\s*=\s*4(?![\d.])/;
    const multiplyEntry = /(?<![\d.])6\s*[×✕*x]\s*3\s*=\s*18(?![\d.])/;
    expect(indexOf(text, sqrtEntry), `expected an entry '√16 = 4', page showed: "${text}"`).toBeGreaterThanOrEqual(0);
    expect(indexOf(text, multiplyEntry), `expected an entry '6 × 3 = 18', page showed: "${text}"`).toBeGreaterThanOrEqual(0);
    expect(indexOf(text, sqrtEntry), "expected '√16 = 4' at the top").toBeLessThan(
      indexOf(text, multiplyEntry),
    );
    expect(entryCount(text)).toBe(2);

    // With the panel open, each new entry goes to the top with its result
    // formatted (sin 30° shows 0.5, not 0.49999999999999994).
    const entries: [Fn, string, RegExp][] = [
      ["sin", "30", /sin\s*\(\s*30\s*°?\s*\)\s*=\s*0\.5(?![\d.])/i],
      ["cos", "60", /cos(?:ine)?\s*\(\s*60\s*°?\s*\)\s*=\s*0\.5(?![\d.])/i],
      ["tan", "45", /tan(?:gent)?\s*\(\s*45\s*°?\s*\)\s*=\s*1(?![\d.])/i],
      ["log", "1000", /log\s*(?:10|₁₀)?\s*\(\s*1000\s*\)\s*=\s*3(?![\d.])/i],
      ["ln", "1", /(?:ln|natural log)\s*\(\s*1\s*\)\s*=\s*0(?![\d.])/i],
    ];
    let previous = sqrtEntry;
    for (const [i, [fn, a, pattern]] of entries.entries()) {
      text = await calcFn(root, fn, a);
      const at = indexOf(text, pattern);
      expect(at, `expected a history entry ${pattern} for ${FN_NAMES[fn]} of ${a}, page showed: "${text}"`).toBeGreaterThanOrEqual(0);
      expect(at, `expected the ${FN_NAMES[fn]} entry at the top, page showed: "${text}"`).toBeLessThan(
        indexOf(text, previous),
      );
      expect(entryCount(text)).toBe(3 + i);
      previous = pattern;
    }
    expect(text).toMatch(/sin\s*\(\s*30\s*°?\s*\)\s*=\s*0\.5(?![\d.])/i);
    expect(text).not.toMatch(/0\.4999|0\.5000|0\.9999|1\.0000|2\.9999/);

    // A two-number calculation after them still goes to the top.
    text = await calcTwo(root, "power", "2", "10");
    const powerAt = indexOf(text, /(?<![\d.])2\s*\^\s*10\s*=\s*1024(?![\d.])/);
    expect(powerAt).toBeGreaterThanOrEqual(0);
    expect(powerAt).toBeLessThan(indexOf(text, previous));
    expect(entryCount(text)).toBe(3 + entries.length);
  });
});
