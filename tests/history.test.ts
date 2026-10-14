import { afterEach, describe, expect, it } from "vitest";
import { mount } from "../src/app";

// These tests drive the calculator and its history panel the way a user
// would: controls are found by what the user sees (input fields, option and
// button labels) and assertions are made on the page's visible text. They
// don't rely on ids, classes or test ids.

type Op = "add" | "subtract" | "multiply" | "divide";

const OP_PATTERNS: Record<Op, RegExp> = {
  add: /add|plus|sum|^\s*\+\s*$/i,
  subtract: /subtract|minus|difference|^\s*[-−–]\s*$/i,
  multiply: /multipl|times|product|^\s*[×*✕x]\s*$/i,
  divide: /divi|quotient|^\s*[÷/]\s*$/i,
};
const OPS: Op[] = ["add", "subtract", "multiply", "divide"];

// The symbol a history entry uses for each operation (e.g. '6 × 3 = 18').
const OP_SYMBOLS: Record<Op, string> = {
  add: "\\+",
  subtract: "[-−–]",
  multiply: "[×✕*x]",
  divide: "[÷/]",
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

describe("history", () => {
  it("adds an entry showing operands, operation and formatted result for each successful calculation, newest first", async () => {
    const root = render();
    await calculate(root, "6", "3", "multiply");
    await calculate(root, "8", "5", "subtract");

    let text = await toggleHistory(root);
    const multiplyAt = entryIndex(text, "6", "multiply", "3", "18");
    const subtractAt = entryIndex(text, "8", "subtract", "5", "3");
    expect(multiplyAt, `expected an entry '6 × 3 = 18', page showed: "${text}"`).toBeGreaterThanOrEqual(0);
    expect(subtractAt, `expected an entry '8 − 5 = 3', page showed: "${text}"`).toBeGreaterThanOrEqual(0);
    expect(subtractAt, "expected the newest entry first").toBeLessThan(multiplyAt);
    expect(entryCount(text)).toBe(2);

    // A calculation made while the panel is open is added too, at the top,
    // with its result formatted (0.1 + 0.2 shows 0.3).
    text = await calculate(root, "0.1", "0.2", "add");
    const addAt = entryIndex(text, "0.1", "add", "0.2", "0.3");
    expect(addAt, `expected an entry '0.1 + 0.2 = 0.3', page showed: "${text}"`).toBeGreaterThanOrEqual(0);
    expect(addAt).toBeLessThan(entryIndex(text, "8", "subtract", "5", "3"));
    expect(entryIndex(text, "8", "subtract", "5", "3")).toBeLessThan(
      entryIndex(text, "6", "multiply", "3", "18"),
    );
    expect(text).not.toContain("0.30000000000000004");
    expect(entryCount(text)).toBe(3);

    // Repeating the same calculation adds another entry.
    text = await calculate(root, "6", "3", "divide");
    text = await calculate(root, "6", "3", "divide");
    expect(entryIndex(text, "6", "divide", "3", "2")).toBeGreaterThanOrEqual(0);
    expect(entryIndex(text, "6", "divide", "3", "2")).toBeLessThan(
      entryIndex(text, "0.1", "add", "0.2", "0.3"),
    );
    expect(entryCount(text)).toBe(5);
  });

  it("adds no entry for calculations that end in an error", async () => {
    // Only errors: the open panel lists no entries.
    const fresh = render();
    await calculate(fresh, "5", "0", "divide");
    await calculate(fresh, "1e308", "10", "multiply");
    await calculate(fresh, "", "3", "add");
    let text = await toggleHistory(fresh);
    expect(entryCount(text), `expected no history entries, page showed: "${text}"`).toBe(0);
    expect(text).not.toMatch(/infinity|nan|∞/i);

    // Errors after a successful calculation leave only that one entry.
    const root = render();
    await calculate(root, "6", "3", "multiply");
    await calculate(root, "5", "0", "divide");
    await calculate(root, "1e308", "10", "multiply");
    await calculate(root, "abc", "3", "add");
    await calculate(root, "6", "", "subtract");
    text = await toggleHistory(root);
    expect(entryIndex(text, "6", "multiply", "3", "18")).toBeGreaterThanOrEqual(0);
    expect(entryCount(text), `expected exactly one history entry, page showed: "${text}"`).toBe(1);

    // Errors made while the panel is open add nothing either.
    text = await calculate(root, "7", "0", "divide");
    expect(entryCount(text)).toBe(1);
    expect(text).not.toMatch(/7\s*[÷/]\s*0/);
    expect(text).not.toMatch(/infinity|nan|∞/i);
  });

  it("shows and hides the panel with a 'History' button; it starts hidden and hides its entries", async () => {
    const root = render();
    const initial = visibleText(root);
    historyButton(root);
    expect(initial.toLowerCase()).not.toContain("no calculations yet");
    expect(entryCount(initial)).toBe(0);

    let text = await calculate(root, "6", "3", "multiply");
    expect(entryIndex(text, "6", "multiply", "3", "18"), "expected entries hidden while the panel is closed").toBe(-1);
    expect(entryCount(text)).toBe(0);

    text = await toggleHistory(root);
    expect(entryIndex(text, "6", "multiply", "3", "18"), `expected the panel to open, page showed: "${text}"`).toBeGreaterThanOrEqual(0);

    text = await toggleHistory(root);
    expect(entryIndex(text, "6", "multiply", "3", "18"), "expected the panel to close").toBe(-1);
    expect(entryCount(text)).toBe(0);

    // Entries added while closed stay hidden, and reopening shows them all.
    text = await calculate(root, "8", "5", "subtract");
    expect(entryCount(text)).toBe(0);
    text = await toggleHistory(root);
    expect(entryIndex(text, "8", "subtract", "5", "3")).toBeGreaterThanOrEqual(0);
    expect(entryIndex(text, "6", "multiply", "3", "18")).toBeGreaterThanOrEqual(0);
  });

  it("shows 'No calculations yet' when opened before any calculation", async () => {
    const root = render();
    let text = await toggleHistory(root);
    expect(text.toLowerCase(), `page showed: "${text}"`).toContain("no calculations yet");
    expect(entryCount(text)).toBe(0);

    text = await calculate(root, "6", "3", "multiply");
    expect(entryIndex(text, "6", "multiply", "3", "18")).toBeGreaterThanOrEqual(0);
    expect(text.toLowerCase()).not.toContain("no calculations yet");
  });
});
