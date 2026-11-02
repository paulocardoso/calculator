import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatNumber, mount } from "../src/app";

// These tests drive the calculator's % key (the on-screen button and the %
// keyboard key) the way a user would: controls are found by what the user
// sees (number fields, option and button labels) and assertions are made on
// the fields' values and the page's visible text. They don't rely on ids,
// classes or test ids.
//
// jsdom doesn't perform a browser's default keyboard actions, so press()
// simulates the one that matters here: a printable key that isn't
// preventDefault()ed (and isn't a Ctrl/Meta/Alt shortcut) is typed into the
// focused text field.

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

function newNumbers(before: string, after: string): number[] {
  return added(numbersIn(before), numbersIn(after));
}

function twoInputs(root: HTMLElement): [HTMLInputElement, HTMLInputElement] {
  const inputs = Array.from(root.querySelectorAll("input")).filter(
    (i) => !NON_OPERAND_TYPES.has(i.type) && !i.readOnly && !i.disabled && isVisible(i),
  );
  expect(inputs, "expected exactly two number inputs").toHaveLength(2);
  return [inputs[0], inputs[1]];
}

function buttons(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, input[type="submit"], input[type="button"], [role="button"]',
    ),
  ).filter((b) => isVisible(b));
}

function percentButton(root: HTMLElement): HTMLElement {
  const btn = buttons(root).find((b) => b.getAttribute("aria-label") === "Percent");
  expect(btn, "expected a visible button with aria-label 'Percent'").toBeDefined();
  const label = btn instanceof HTMLInputElement ? btn.value : btn!.textContent;
  expect((label ?? "").trim(), "expected the Percent button to be labelled '%'").toBe("%");
  return btn!;
}

function calculateButton(root: HTMLElement): HTMLElement {
  const btn = buttons(root).find((b) => /^\s*calculate\s*$/i.test(b.textContent ?? ""));
  expect(btn, "expected a Calculate button").toBeDefined();
  return btn!;
}

function historyButton(root: HTMLElement): HTMLElement {
  const btn = buttons(root).find((b) => /^\s*history\s*$/i.test(b.textContent ?? ""));
  expect(btn, "expected a History button").toBeDefined();
  return btn!;
}

// Chooses an operation from the operation list with the mouse.
function chooseOp(root: HTMLElement, label: string): void {
  const select = root.querySelector("select");
  expect(select, "expected an operation list").not.toBeNull();
  const option = Array.from(select!.options).find((o) => (o.textContent ?? "").trim() === label);
  expect(option, `expected an operation '${label}'`).toBeDefined();
  select!.value = option!.value;
  option!.selected = true;
  select!.dispatchEvent(new Event("input", { bubbles: true }));
  select!.dispatchEvent(new Event("change", { bubbles: true }));
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

async function click(el: HTMLElement): Promise<void> {
  el.click();
  await settle();
}

const typed = new WeakMap<HTMLInputElement, { text: string; value: string }>();

function isTextField(el: Element | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && !NON_OPERAND_TYPES.has(el.type);
}

type Modifiers = { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean };

// Presses a key with the current focus, like a user at the keyboard. Returns
// whether the keydown was preventDefault()ed.
async function press(key: string, modifiers: Modifiers = {}): Promise<boolean> {
  const target = (document.activeElement as HTMLElement | null) ?? document.body;
  const init: KeyboardEventInit = {
    key,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...modifiers,
  };
  const down = new KeyboardEvent("keydown", init);
  target.dispatchEvent(down);
  const downPrevented = down.defaultPrevented;
  let prevented = downPrevented;
  const shortcut = !!(modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey);
  const printable = key.length === 1 && !shortcut;
  if (!prevented && printable) {
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
    }
  }
  const upTarget = (document.activeElement as HTMLElement | null) ?? document.body;
  upTarget.dispatchEvent(new KeyboardEvent("keyup", init));
  await settle();
  return downPrevented;
}

async function type(text: string): Promise<void> {
  for (const ch of text) await press(ch);
}

function expectNoResult(root: HTMLElement, before: string, context: string): void {
  const text = visibleText(root);
  expect(text, `${context}: expected no result to be shown, page: "${text}"`).not.toMatch(
    /result/i,
  );
  expect(
    newNumbers(before, text),
    `${context}: expected no new numbers on the page, page: "${text}"`,
  ).toEqual([]);
}

function expectValidationError(root: HTMLElement, context: string): void {
  const text = visibleText(root);
  expect(
    text,
    `${context}: expected a validation error asking for a valid number, page: "${text}"`,
  ).toMatch(/valid number/i);
}

function expectNoValidationError(root: HTMLElement, context: string): void {
  const text = visibleText(root);
  expect(text, `${context}: expected no validation error, page: "${text}"`).not.toMatch(
    /valid number/i,
  );
}

describe("percent", () => {
  it("shows a '%' button (aria-label 'Percent') that divides the first field by 100 when no operation is chosen, without calculating or adding history", async () => {
    const root = render();
    const before = visibleText(root);
    const [a, b] = twoInputs(root);
    const btn = percentButton(root);

    setValue(a, "50");
    await click(btn);
    expect(a.value, "% should turn 50 in the first field into 0.5").toBe("0.5");
    expect(b.value, "% should leave the second field alone").toBe("");
    expectNoResult(root, before, "after % on the first field");
    expectNoValidationError(root, "after % on the first field");

    // Pressing it again works on the new value.
    await click(btn);
    expect(a.value).toBe("0.005");
    expectNoResult(root, before, "after % twice");

    // No history entry was added.
    await click(historyButton(root));
    const text = visibleText(root);
    expect(text.toLowerCase(), `expected an empty history, page: "${text}"`).toContain(
      "no calculations yet",
    );
    expect(text, "expected no history entries").not.toContain("=");
  });

  it("works on the second field after an operation is chosen: 200 + 10% calculates 200.1", async () => {
    const root = render();
    const before = visibleText(root);
    const [a, b] = twoInputs(root);

    setValue(a, "200");
    chooseOp(root, "Add");
    setValue(b, "10");
    await click(percentButton(root));
    expect(b.value, "% should turn 10 in the second field into 0.1").toBe("0.1");
    expect(a.value, "% should leave the first field alone once an operation is chosen").toBe(
      "200",
    );
    expectNoResult(root, before, "after % on the second field");

    await click(calculateButton(root));
    const text = visibleText(root);
    expect(text, `expected 'Result: 200.1', page: "${text}"`).toMatch(
      /result:\s*200\.1(?![\d.])/i,
    );
  });

  it("produces values without floating point noise, formatted like results", async () => {
    const cases = ["33", "0.3", "0.07", "1.1", "-12.5", "7"];
    const expected: Record<string, string> = {
      "33": "0.33",
      "0.3": "0.003",
      "0.07": "0.0007",
      "1.1": "0.011",
      "-12.5": "-0.125",
      "7": "0.07",
    };

    for (const value of cases) {
      // In the first field.
      let root = render();
      let [a, b] = twoInputs(root);
      setValue(a, value);
      await click(percentButton(root));
      expect(a.value, `% on ${value} in the first field`).toBe(expected[value]);
      expect(a.value).toBe(formatNumber(Number(value) / 100));

      // In the second field.
      root = render();
      [a, b] = twoInputs(root);
      setValue(a, "1");
      chooseOp(root, "Multiply");
      setValue(b, value);
      await click(percentButton(root));
      expect(b.value, `% on ${value} in the second field`).toBe(expected[value]);
      expect(a.value).toBe("1");
    }
  });

  it("applies % from the keyboard with focus outside the number fields or in the active field, never types '%', and ignores it with Ctrl, Meta or Alt", async () => {
    // Focus outside the fields, no operation chosen: the first field.
    let root = render();
    let before = visibleText(root);
    let [a, b] = twoInputs(root);
    setValue(a, "50");
    focusOutside();
    await press("%");
    expect(a.value, "% with focus outside should turn the first field's 50 into 0.5").toBe("0.5");
    expect(b.value).toBe("");
    expectNoResult(root, before, "after the % key with focus outside");

    // Focus on another control in the app (the operation list) counts as outside.
    root = render();
    [a, b] = twoInputs(root);
    setValue(a, "33");
    root.querySelector("select")!.focus();
    await press("%");
    expect(a.value, "% with focus on the operation list").toBe("0.33");

    // Focus in the first field, the active field: no '%' typed.
    root = render();
    before = visibleText(root);
    [a, b] = twoInputs(root);
    setValue(a, "50");
    a.focus();
    const prevented = await press("%");
    expect(a.value, "% in the first field should turn 50 into 0.5 without typing '%'").toBe(
      "0.5",
    );
    expect(prevented, "the % key in a number field should not insert '%'").toBe(true);
    expect(b.value).toBe("");
    expectNoResult(root, before, "after the % key in the first field");

    // After choosing an operation, focus in the second field (now active).
    root = render();
    before = visibleText(root);
    [a, b] = twoInputs(root);
    setValue(a, "200");
    chooseOp(root, "Add");
    setValue(b, "10");
    b.focus();
    await press("%");
    expect(b.value, "% in the second field should turn 10 into 0.1").toBe("0.1");
    expect(a.value).toBe("200");
    await click(calculateButton(root));
    expect(visibleText(root)).toMatch(/result:\s*200\.1(?![\d.])/i);

    // After choosing an operation, focus outside: the second field.
    root = render();
    [a, b] = twoInputs(root);
    setValue(a, "200");
    chooseOp(root, "Add");
    setValue(b, "0.3");
    focusOutside();
    await press("%");
    expect(b.value, "% with focus outside after choosing an operation").toBe("0.003");
    expect(a.value).toBe("200");

    // With Ctrl, Meta or Alt held the key is ignored.
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }] as Modifiers[]) {
      const name = Object.keys(mod)[0];
      for (const where of ["outside", "first"] as const) {
        root = render();
        before = visibleText(root);
        [a, b] = twoInputs(root);
        setValue(a, "50");
        if (where === "outside") focusOutside();
        else a.focus();
        const handled = await press("%", mod);
        expect(a.value, `% with ${name} (focus ${where}) should be ignored`).toBe("50");
        expect(b.value).toBe("");
        expect(handled, `% with ${name} (focus ${where}) should be left to the browser`).toBe(
          false,
        );
        expectNoResult(root, before, `after % with ${name}`);
        expectNoValidationError(root, `after % with ${name}`);
      }
    }
  });

  it("shows a validation error and leaves the field unchanged when the active field is empty or not a valid number", async () => {
    // Button, empty first field.
    let root = render();
    let before = visibleText(root);
    let [a, b] = twoInputs(root);
    await click(percentButton(root));
    expectValidationError(root, "% with an empty first field");
    expect(a.value).toBe("");
    expect(b.value).toBe("");
    expectNoResult(root, before, "% with an empty first field");

    // Key with focus in the empty first field.
    root = render();
    before = visibleText(root);
    [a, b] = twoInputs(root);
    a.focus();
    await press("%");
    expectValidationError(root, "the % key in an empty first field");
    expect(a.value).toBe("");
    expectNoResult(root, before, "the % key in an empty first field");

    // Key with focus outside, while the typed text isn't a valid number yet
    // ("1."): the error is shown and the typed text is kept.
    root = render();
    before = visibleText(root);
    [a, b] = twoInputs(root);
    focusOutside();
    await type("1.");
    await press("%");
    expectValidationError(root, "the % key while the first field holds '1.'");
    expectNoResult(root, before, "the % key while the first field holds '1.'");
    focusOutside();
    await type("5");
    expect(a.value, "the field's typed text '1.' should be unchanged by %").toBe("1.5");

    // Button, empty second field after a result was shown: the error replaces
    // the result and both fields are unchanged.
    root = render();
    before = visibleText(root);
    [a, b] = twoInputs(root);
    setValue(a, "6");
    chooseOp(root, "Add");
    setValue(b, "3");
    await click(calculateButton(root));
    expect(visibleText(root)).toMatch(/result:\s*9(?![\d.])/i);
    setValue(b, "");
    await click(percentButton(root));
    expectValidationError(root, "% with an empty second field");
    expect(a.value, "the first field should be unchanged").toBe("6");
    expect(b.value, "the second field should be unchanged").toBe("");
    expectNoResult(root, before, "% with an empty second field");

    // Key in the empty second field.
    root = render();
    before = visibleText(root);
    [a, b] = twoInputs(root);
    setValue(a, "6");
    chooseOp(root, "Add");
    b.focus();
    await press("%");
    expectValidationError(root, "the % key in an empty second field");
    expect(a.value).toBe("6");
    expect(b.value).toBe("");
    expectNoResult(root, before, "the % key in an empty second field");
  });
});
