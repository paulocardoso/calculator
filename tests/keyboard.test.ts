import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "../src/app";

// These tests drive the calculator from the keyboard the way a user would.
// Like tests/calculator.test.ts, they find the two number fields, the
// operation choice and the calculate button by what the user sees, and read
// the page's visible text. They don't rely on ids, classes or test ids.
//
// jsdom doesn't perform a browser's default keyboard actions, so press()
// simulates the ones that matter here: a printable key that isn't
// preventDefault()ed is typed into the focused text field, and Enter in a
// field of a form submits the form (implicit submission). This way the tests
// pass whether the app handles a key itself or relies on the browser.

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

// Listeners an app adds to window/document/body would otherwise outlive the
// app that added them and react to later key presses, so they are tracked
// and removed when the next app is rendered and after each test.
type Tracked = [EventTarget, string, EventListenerOrEventListenerObject | null, unknown];
let tracked: Tracked[] = [];
let restore: (() => void)[] = [];

function globalTargets(): EventTarget[] {
  return [window, document, document.documentElement, document.body];
}

beforeEach(() => {
  for (const t of globalTargets()) {
    const own = Object.getOwnPropertyDescriptor(t, "addEventListener");
    const original = (t as EventTarget).addEventListener;
    Object.defineProperty(t, "addEventListener", {
      configurable: true,
      writable: true,
      value: function (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        tracked.push([t, type, listener, options]);
        return original.call(t, type, listener, options);
      },
    });
    restore.push(() => {
      if (own) Object.defineProperty(t, "addEventListener", own);
      else delete (t as unknown as Record<string, unknown>).addEventListener;
    });
  }
  (document.activeElement as HTMLElement | null)?.blur?.();
});

// Removes rendered apps and the global listeners they added, so only one app
// is ever listening to the keyboard.
function unmountAll(): void {
  for (const r of roots) r.remove();
  roots = [];
  for (const [t, type, listener, options] of tracked) {
    t.removeEventListener(type, listener, options as boolean | EventListenerOptions | undefined);
  }
  tracked = [];
  document.onkeydown = null;
  document.onkeypress = null;
  document.onkeyup = null;
  window.onkeydown = null;
  window.onkeypress = null;
  window.onkeyup = null;
  document.body.onkeydown = null;
  document.body.onkeypress = null;
  document.body.onkeyup = null;
}

afterEach(() => {
  unmountAll();
  for (const r of restore) r();
  restore = [];
});

function render(): HTMLElement {
  unmountAll();
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

function twoInputs(root: HTMLElement): [HTMLInputElement, HTMLInputElement] {
  const inputs = operandInputs(root);
  expect(inputs, "expected exactly two number inputs").toHaveLength(2);
  return [inputs[0], inputs[1]];
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

// Chooses an operation with the mouse (select, radio or button), without
// moving keyboard focus.
function chooseOp(root: HTMLElement, op: Op): void {
  for (const select of Array.from(root.querySelectorAll("select"))) {
    const option = Array.from(select.options).find(
      (o) => matchesOp(o.value, op) || matchesOp(o.textContent ?? "", op),
    );
    if (option) {
      select.value = option.value;
      option.selected = true;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }
  const radio = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
    (r) => matchesOp(labelText(r), op),
  );
  if (radio) {
    radio.click();
    return;
  }
  const btn = opButton(root, op);
  expect(btn, `expected a way to choose "${op}"`).toBeDefined();
  btn!.click();
}

function calculateButton(root: HTMLElement): HTMLElement {
  const candidates = buttons(root).filter((b) => !OPS.some((o) => matchesOp(labelText(b), o)));
  const btn =
    candidates.find((b) => /calc|equal|compute|result|^\s*=\s*$/i.test(labelText(b))) ??
    (candidates.length === 1 ? candidates[0] : undefined);
  expect(btn, "expected a calculate button").toBeDefined();
  return btn!;
}

function setValue(input: HTMLInputElement, value: string): void {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function focusOutside(): void {
  (document.activeElement as HTMLElement | null)?.blur?.();
  expect(document.activeElement === null || document.activeElement === document.body).toBe(true);
}

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

// What a user has typed into each text field. A number field's value is ""
// while its text isn't a valid number yet (e.g. "-" or "1."), so the typed
// text is remembered until something else changes the field's value.
const typed = new WeakMap<HTMLInputElement, { text: string; value: string }>();

function isTextField(el: Element | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && !NON_OPERAND_TYPES.has(el.type);
}

// Presses a key with the current focus, like a user at the keyboard.
async function press(key: string): Promise<void> {
  const target = (document.activeElement as HTMLElement | null) ?? document.body;
  const init: KeyboardEventInit = { key, bubbles: true, cancelable: true, composed: true };
  const down = new KeyboardEvent("keydown", init);
  target.dispatchEvent(down);
  let prevented = down.defaultPrevented;
  const printable = key.length === 1;
  if (!prevented && (printable || key === "Enter")) {
    const pressTarget = (document.activeElement as HTMLElement | null) ?? document.body;
    const kp = new KeyboardEvent("keypress", init);
    pressTarget.dispatchEvent(kp);
    prevented = kp.defaultPrevented;
  }
  if (!prevented) {
    const focused = document.activeElement;
    if (printable && isTextField(focused) && !focused.readOnly && !focused.disabled) {
      // Browser default: type the character into the focused field.
      const state = typed.get(focused);
      const current = state && state.value === focused.value ? state.text : focused.value;
      const next = current + key;
      focused.value = next;
      typed.set(focused, { text: next, value: focused.value });
      focused.dispatchEvent(
        new InputEvent("input", { bubbles: true, data: key, inputType: "insertText" }),
      );
    } else if (key === "Enter" && isTextField(focused) && focused.form) {
      // Browser default: implicit submission of the field's form.
      focused.form.requestSubmit();
    }
  }
  const upTarget = (document.activeElement as HTMLElement | null) ?? document.body;
  upTarget.dispatchEvent(new KeyboardEvent("keyup", init));
  await settle();
}

async function type(text: string): Promise<void> {
  for (const ch of text) await press(ch);
}

function newNumbers(before: string, after: string): number[] {
  return added(numbersIn(before), numbersIn(after));
}

function expectShowsNumber(before: string, after: string, expected: number): void {
  const nums = newNumbers(before, after);
  expect(
    nums.some((n) => Math.abs(n - expected) < 1e-9),
    `expected the result ${expected} to be shown, but new numbers on the page were [${nums.join(", ")}] (page: "${after}")`,
  ).toBe(true);
}

const VALIDATION_WORDS =
  /invalid|valid|error|enter|required|missing|please|number|numeric|empty|must|provide/i;

describe("keyboard", () => {
  it("types digits and '.' into the first field by default, and into the second field after an operation is chosen, when focus is outside the number fields", async () => {
    const root = render();
    const before = visibleText(root);
    const [a, b] = twoInputs(root);

    focusOutside();
    await type("1.5");
    expect(a.value, "digits typed outside the fields should go to the first field").toBe("1.5");
    expect(b.value).toBe("");

    chooseOp(root, "multiply");
    focusOutside();
    await type("4");
    expect(b.value, "after choosing an operation, digits should go to the second field").toBe(
      "4",
    );
    expect(a.value, "the first field should be unchanged").toBe("1.5");

    focusOutside();
    await type("0.5");
    expect(b.value).toBe("40.5");
    expect(a.value).toBe("1.5");

    calculateButton(root).click();
    await settle();
    expectShowsNumber(before, visibleText(root), 60.75);
  });

  it("selects the operation with +, -, * and / when the first field holds a number and moves focus to the second field; '-' in an empty field types a minus sign", async () => {
    const cases: [string, Op, number][] = [
      ["+", "add", 9],
      ["-", "subtract", 3],
      ["*", "multiply", 18],
      ["/", "divide", 2],
    ];
    // Starting with a different operation chosen, so each key must change it.
    const other: Record<Op, Op> = {
      add: "divide",
      subtract: "multiply",
      multiply: "subtract",
      divide: "add",
    };

    for (const outside of [false, true]) {
      for (const [key, op, expected] of cases) {
        const root = render();
        const before = visibleText(root);
        const [a, b] = twoInputs(root);
        chooseOp(root, other[op]);
        setValue(a, "6");
        if (outside) focusOutside();
        else a.focus();

        await press(key);
        const where = outside ? "with focus outside the fields" : "with focus in the first field";
        expect(
          document.activeElement,
          `pressing "${key}" ${where} should move focus to the second field`,
        ).toBe(b);
        expect(a.value, `pressing "${key}" should not change the first field`).toBe("6");
        expect(b.value, `pressing "${key}" should not type into the second field`).toBe("");

        await type("3");
        expect(b.value).toBe("3");
        calculateButton(root).click();
        await settle();
        const text = visibleText(root);
        expectShowsNumber(before, text, expected);
        root.remove();
      }
    }

    // '-' in an empty first field types a minus sign instead of choosing subtract.
    const root = render();
    const before = visibleText(root);
    const [a, b] = twoInputs(root);
    chooseOp(root, "multiply");
    a.focus();
    await press("-");
    expect(document.activeElement, "'-' in an empty field should keep focus there").toBe(a);
    await type("5");
    expect(a.value, "'-' then '5' in an empty field should give -5").toBe("-5");
    expect(document.activeElement).toBe(a);
    expect(b.value).toBe("");
    setValue(b, "3");
    calculateButton(root).click();
    await settle();
    // Still multiply: -5 × 3 = -15 (subtract would give -8).
    expectShowsNumber(before, visibleText(root), -15);
  });

  it("calculates on Enter anywhere in the app, showing the result or the error like the Calculate button", async () => {
    type Where = "outside" | "select" | "first" | "second";
    const focusAt = (root: HTMLElement, where: Where): void => {
      const [a, b] = twoInputs(root);
      if (where === "outside") focusOutside();
      else if (where === "first") a.focus();
      else if (where === "second") b.focus();
      else {
        const select = root.querySelector("select");
        if (select) select.focus();
        else focusOutside();
      }
    };

    for (const where of ["outside", "select", "first", "second"] as Where[]) {
      // A result.
      let root = render();
      let before = visibleText(root);
      let [a, b] = twoInputs(root);
      setValue(a, "6");
      setValue(b, "3");
      chooseOp(root, "multiply");
      focusAt(root, where);
      await press("Enter");
      expectShowsNumber(before, visibleText(root), 18);
      root.remove();

      // The divide-by-zero error.
      root = render();
      before = visibleText(root);
      [a, b] = twoInputs(root);
      setValue(a, "5");
      setValue(b, "0");
      chooseOp(root, "divide");
      focusAt(root, where);
      await press("Enter");
      let text = visibleText(root);
      expect(text.toLowerCase(), `Enter (${where}) should show the error`).toContain(
        "cannot divide by zero",
      );
      expect(text).not.toMatch(/infinity|nan|∞/i);
      root.remove();

      // The validation error for an empty field.
      root = render();
      before = visibleText(root);
      [a, b] = twoInputs(root);
      setValue(a, "6");
      chooseOp(root, "add");
      focusAt(root, where);
      await press("Enter");
      text = visibleText(root);
      expect(
        added(wordsIn(before), wordsIn(text)).some((w) => VALIDATION_WORDS.test(w)),
        `Enter (${where}) with an empty field should show a validation error, page showed: "${text}"`,
      ).toBe(true);
      expect(newNumbers(before, text).filter((n) => n !== 6)).toEqual([]);
      root.remove();
    }
  });

  it("clears both fields, the result and any error on Escape and puts focus in the first field", async () => {
    // After a result, with focus in the second field.
    let root = render();
    let before = visibleText(root);
    let [a, b] = twoInputs(root);
    setValue(a, "6");
    setValue(b, "3");
    chooseOp(root, "add");
    calculateButton(root).click();
    await settle();
    expectShowsNumber(before, visibleText(root), 9);
    b.focus();
    await press("Escape");
    expect(a.value).toBe("");
    expect(b.value).toBe("");
    let text = visibleText(root);
    expect(newNumbers(before, text), `the result should be cleared, page: "${text}"`).toEqual([]);
    expect(added(wordsIn(before), wordsIn(text))).toEqual([]);
    expect(document.activeElement, "Escape should put focus in the first field").toBe(a);
    root.remove();

    // After an error, with focus outside the fields.
    root = render();
    before = visibleText(root);
    [a, b] = twoInputs(root);
    setValue(a, "5");
    setValue(b, "0");
    chooseOp(root, "divide");
    calculateButton(root).click();
    await settle();
    expect(visibleText(root).toLowerCase()).toContain("cannot divide by zero");
    focusOutside();
    await press("Escape");
    expect(a.value).toBe("");
    expect(b.value).toBe("");
    text = visibleText(root);
    expect(text.toLowerCase()).not.toContain("cannot divide by zero");
    expect(newNumbers(before, text)).toEqual([]);
    expect(added(wordsIn(before), wordsIn(text)), `the error should be cleared, page: "${text}"`).toEqual([]);
    expect(document.activeElement, "Escape should put focus in the first field").toBe(a);
    root.remove();

    // After a validation error, with focus in the first field.
    root = render();
    before = visibleText(root);
    [a, b] = twoInputs(root);
    setValue(a, "abc");
    setValue(b, "3");
    calculateButton(root).click();
    await settle();
    expect(added(wordsIn(before), wordsIn(visibleText(root))).length).toBeGreaterThan(0);
    a.focus();
    await press("Escape");
    expect(a.value).toBe("");
    expect(b.value).toBe("");
    text = visibleText(root);
    expect(added(wordsIn(before), wordsIn(text))).toEqual([]);
    expect(newNumbers(before, text)).toEqual([]);
    expect(document.activeElement).toBe(a);
  });
});
