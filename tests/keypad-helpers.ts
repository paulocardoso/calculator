import { afterEach, beforeEach, expect } from "vitest";
import { mount } from "../src/app";

// Shared helpers for the tests that drive the calculator's keypad the way a
// user would. Keys are found by what the user sees: a button's text, its
// aria-label or its title (for example '7', '×' or 'Memory plus'). The
// display is the element that shows '0' when the app starts. Nothing here
// relies on ids, classes or test ids.

export type Key =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "."
  | "AC"
  | "±"
  | "%"
  | "+"
  | "−"
  | "×"
  | "÷"
  | "xʸ"
  | "ʸ√x"
  | "="
  | "√"
  | "sin"
  | "cos"
  | "tan"
  | "log"
  | "ln"
  | "mc"
  | "mr"
  | "m+"
  | "m−"
  | "History";

// A key matches when its text, aria-label or title matches its pattern.
const KEY_PATTERNS: Record<Key, RegExp> = {
  "0": /^0$/,
  "1": /^1$/,
  "2": /^2$/,
  "3": /^3$/,
  "4": /^4$/,
  "5": /^5$/,
  "6": /^6$/,
  "7": /^7$/,
  "8": /^8$/,
  "9": /^9$/,
  ".": /^(\.|decimal|decimal point|point)$/i,
  AC: /^(AC|C|all clear|clear)$/i,
  "±": /^(±|\+\/[-−–]|plus[\s/-]*(or[\s]*)?minus|negate|change sign|toggle sign)$/i,
  "%": /^(%|percent)$/i,
  "+": /^(\+|plus|add)$/i,
  "−": /^([-−–]|minus|subtract)$/i,
  "×": /^([×✕*]|times|multiply|multiplied by)$/i,
  "÷": /^([÷/]|divide|divided by)$/i,
  "xʸ": /^(xʸ|x\^y|\^|power|x to the power of y)$/i,
  "ʸ√x": /^(ʸ√x|y√x|root|nth root|y-th root|y root of x)$/i,
  "=": /^(=|equals)$/i,
  "√": /^(√|√x|²√x|square root)$/i,
  sin: /^(sin|sine)$/i,
  cos: /^(cos|cosine)$/i,
  tan: /^(tan|tangent)$/i,
  log: /^(log|log₁₀|log10|log base 10|log \(base 10\))$/i,
  ln: /^(ln|natural log)$/i,
  mc: /^(mc|memory clear|clear memory)$/i,
  mr: /^(mr|memory recall|recall memory)$/i,
  "m+": /^(m\s*\+|memory plus|memory add)$/i,
  "m−": /^(m\s*[-−–]|memory minus|memory subtract)$/i,
  History: /history/i,
};

const STORE_PATTERN = /store.*memory/i;

export const NON_TEXT_INPUT_TYPES = new Set([
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
const displays = new WeakMap<HTMLElement, HTMLElement>();

// Listeners an app adds to window/document/body would otherwise outlive the
// app that added them and react to later key presses, so they are tracked
// and removed when the next app is rendered and after each test.
type Tracked = [EventTarget, string, EventListenerOrEventListenerObject | null, unknown];
let tracked: Tracked[] = [];
let restore: (() => void)[] = [];

function globalTargets(): EventTarget[] {
  return [window, document, document.documentElement, document.body];
}

function unmountAll(): void {
  for (const r of roots) r.remove();
  roots = [];
  for (const [t, type, listener, options] of tracked) {
    t.removeEventListener(type, listener, options as boolean | EventListenerOptions | undefined);
  }
  tracked = [];
  for (const t of [document, window, document.body] as unknown as Record<string, unknown>[]) {
    t.onkeydown = null;
    t.onkeypress = null;
    t.onkeyup = null;
  }
}

// useApp registers the setup and cleanup every keypad test file needs. Call
// it once at the top level of a test file.
export function useApp(): void {
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

  afterEach(() => {
    unmountAll();
    for (const r of restore) r();
    restore = [];
  });
}

// render mounts a fresh app (removing any earlier one) and finds its display.
export function render(): HTMLElement {
  unmountAll();
  const root = document.createElement("div");
  document.body.appendChild(root);
  roots.push(root);
  mount(root);
  displays.set(root, findDisplay(root));
  return root;
}

function isHidden(el: Element): boolean {
  if (el instanceof HTMLElement && el.hidden) return true;
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "template") return true;
  const style = window.getComputedStyle(el);
  return style.display === "none" || style.visibility === "hidden";
}

export function isVisible(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (isHidden(node)) return false;
  }
  return true;
}

function isButton(el: Element): boolean {
  return (
    el instanceof HTMLButtonElement ||
    el.getAttribute("role") === "button" ||
    (el instanceof HTMLInputElement && ["button", "submit", "reset"].includes(el.type))
  );
}

// The text a user can see in root, including values of read-only fields.
// With skipButtons, the labels of buttons (the keypad, 'Store in memory') are
// left out.
export function visibleText(root: Element, skipButtons = false): string {
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (!(node instanceof Element)) return;
    if (isHidden(node)) return;
    if (skipButtons && isButton(node)) return;
    if (
      node instanceof HTMLInputElement &&
      (node.readOnly || node.disabled) &&
      !NON_TEXT_INPUT_TYPES.has(node.type)
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

// The display is the element showing '0' when the app starts: the innermost
// visible element (not a key) whose text is '0', or a read-only field
// holding '0'.
function findDisplay(root: HTMLElement): HTMLElement {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>("*")).filter((el) => {
    if (!isVisible(el) || isButton(el)) return false;
    if (el.querySelector('button, [role="button"], input')) {
      return false;
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return (el.readOnly || el.disabled) && el.value.trim() === "0";
    }
    return visibleText(el) === "0";
  });
  const innermost = candidates.filter((el) => !candidates.some((c) => c !== el && el.contains(c)));
  expect(
    innermost,
    `expected exactly one display showing '0' when the app starts, page showed: "${visibleText(root)}"`,
  ).toHaveLength(1);
  return innermost[0];
}

// display returns what the display shows, with '−' written as '-' and any
// thousands separators in numbers removed.
export function display(root: HTMLElement): string {
  const el = displays.get(root);
  expect(el, "render the app with render() first").toBeDefined();
  let text: string;
  if (!isVisible(el!)) text = "";
  else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    text = el.value.replace(/\s+/g, " ").trim();
  } else text = visibleText(el!);
  text = text.replace(/[−–]/g, "-");
  if (/^[-\d.,\s]+$/.test(text)) text = text.replace(/[,\s]/g, "");
  return text;
}

export function expectDisplay(root: HTMLElement, expected: string, context: string): void {
  expect(display(root), `${context}: expected the display to show '${expected}'`).toBe(expected);
}

// expectDisplayError checks the display shows the message instead of a number.
export function expectDisplayError(root: HTMLElement, message: string, context: string): void {
  const shown = display(root);
  expect(shown.toLowerCase(), `${context}: expected the display to show '${message}'`).toContain(
    message.toLowerCase(),
  );
  expect(shown, `${context}: expected no number in the display next to the error`).not.toMatch(/\d/);
  expect(shown).not.toMatch(/infinity|nan|∞/i);
}

export function buttons(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, input[type="submit"], input[type="button"], [role="button"]',
    ),
  ).filter(isVisible);
}

function labelParts(el: HTMLElement): string[] {
  const parts: string[] = [];
  if (el instanceof HTMLInputElement) parts.push(el.value);
  else parts.push(el.textContent ?? "");
  parts.push(el.getAttribute("aria-label") ?? "");
  parts.push(el.getAttribute("title") ?? "");
  return parts.map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p !== "");
}

export function isStoreControl(b: HTMLElement): boolean {
  return labelParts(b).some((p) => STORE_PATTERN.test(p));
}

function matchesKey(b: HTMLElement, k: Key): boolean {
  if (isStoreControl(b)) return false;
  return labelParts(b).some((p) => KEY_PATTERNS[k].test(p));
}

// findKey returns the visible key k, or undefined if there isn't one.
export function findKey(root: HTMLElement, k: Key): HTMLElement | undefined {
  const matches = buttons(root).filter((b) => matchesKey(b, k));
  if (k !== "History") {
    expect(
      matches.length,
      `expected one '${k}' key, found ${matches.length}: ${matches.map((m) => labelParts(m).join("/")).join(", ")}`,
    ).toBeLessThanOrEqual(1);
  }
  return matches[0];
}

export function key(root: HTMLElement, k: Key): HTMLElement {
  const btn = findKey(root, k);
  expect(btn, `expected a visible '${k}' key`).toBeDefined();
  return btn!;
}

export async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

// tap clicks keys in order. A string of digits and '.' (such as '0.25') is
// tapped one character at a time; anything else names one key.
export async function tap(root: HTMLElement, ...keys: string[]): Promise<void> {
  for (const k of keys) {
    const sequence = /^[0-9.]+$/.test(k) ? k.split("") : [k];
    for (const s of sequence) {
      key(root, s as Key).click();
      await settle();
    }
  }
}

// calc renders a fresh app, taps the keys and returns the app.
export async function calc(...keys: string[]): Promise<HTMLElement> {
  const root = render();
  await tap(root, ...keys);
  return root;
}

export type Modifiers = { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean };

// press presses a key on the keyboard with the current focus, like a user.
// Returns whether the keydown was preventDefault()ed.
export async function press(k: string, modifiers: Modifiers = {}): Promise<boolean> {
  const init: KeyboardEventInit = { key: k, bubbles: true, cancelable: true, composed: true, ...modifiers };
  const target = (document.activeElement as HTMLElement | null) ?? document.body;
  const down = new KeyboardEvent("keydown", init);
  target.dispatchEvent(down);
  const shortcut = !!(modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey);
  if (!down.defaultPrevented && (k.length === 1 || k === "Enter") && !shortcut) {
    ((document.activeElement as HTMLElement | null) ?? document.body).dispatchEvent(
      new KeyboardEvent("keypress", init),
    );
  }
  ((document.activeElement as HTMLElement | null) ?? document.body).dispatchEvent(
    new KeyboardEvent("keyup", init),
  );
  await settle();
  return down.defaultPrevented;
}

export async function type(text: string): Promise<void> {
  for (const ch of text) await press(ch);
}

export function focusOutside(): void {
  (document.activeElement as HTMLElement | null)?.blur?.();
  expect(document.activeElement === null || document.activeElement === document.body).toBe(true);
}

// Editable fields and dropdowns left on the page.
export function editableFields(root: HTMLElement): Element[] {
  return Array.from(root.querySelectorAll("input, textarea, select, [contenteditable]")).filter((el) => {
    if (el instanceof HTMLSelectElement) return true;
    if (el instanceof HTMLInputElement) {
      return !NON_TEXT_INPUT_TYPES.has(el.type) && !el.readOnly && !el.disabled;
    }
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    return el.getAttribute("contenteditable") !== "false";
  });
}

// The value shown by the memory indicator ('M: 9'), or undefined when no
// indicator is visible.
export function memoryShown(root: HTMLElement): number | undefined {
  const text = visibleText(root, true).replace(/[−–]/g, "-");
  const m = /(?<![A-Za-z])M(?:emory)?\s*:\s*(-?\d+(?:\.\d+)?)(?![\d.])/i.exec(text);
  return m ? parseFloat(m[1]) : undefined;
}

export function hasMemoryIndicator(root: HTMLElement): boolean {
  return /(?<![A-Za-z])M(?:emory)?\s*:/i.test(visibleText(root, true));
}

export function expectMemory(root: HTMLElement, expected: number, context: string): void {
  const shown = memoryShown(root);
  expect(
    shown !== undefined && Math.abs(shown - expected) < 1e-9,
    `${context}: expected the memory indicator to show 'M: ${expected}', page showed: "${visibleText(root, true)}"`,
  ).toBe(true);
}

export function expectNoMemoryIndicator(root: HTMLElement, context: string): void {
  expect(
    hasMemoryIndicator(root),
    `${context}: expected no memory indicator while memory is 0, page showed: "${visibleText(root, true)}"`,
  ).toBe(false);
}

export function storeControls(root: HTMLElement): HTMLElement[] {
  return buttons(root).filter(isStoreControl);
}

// The visible text of the history entry a 'Store in memory' control belongs
// to: its nearest ancestor showing a single 'expression = result'.
function entryOf(control: HTMLElement, root: HTMLElement): string {
  for (let node = control.parentElement; node && node !== root.parentElement; node = node.parentElement) {
    const text = visibleText(node, true);
    const count = (text.match(/=/g) ?? []).length;
    if (count === 0) continue;
    expect(count, `expected the 'Store in memory' control to belong to a single entry, found "${text}"`).toBe(1);
    return text.replace(/[−–]/g, "-");
  }
  throw new Error("expected the 'Store in memory' control to be part of a history entry");
}

// The visible history entries, top first. Each entry has its own 'Store in
// memory' control.
export function historyEntries(root: HTMLElement): { text: string; store: HTMLElement }[] {
  return storeControls(root).map((store) => ({ text: entryOf(store, root), store }));
}

export async function toggleHistory(root: HTMLElement): Promise<void> {
  key(root, "History").click();
  await settle();
}

// Opens the history panel unless it's already open.
export async function openHistory(root: HTMLElement): Promise<void> {
  if (historyEntries(root).length === 0 && !/no calculations yet/i.test(visibleText(root))) {
    await toggleHistory(root);
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SYMBOLS: Record<string, string> = {
  "+": "\\+",
  "−": "[-−–]",
  "×": "[×✕*x]",
  "÷": "[÷/]",
  "^": "\\^",
  "√": "√",
};

// Matches a two-number entry such as '6 × 3 = 18'.
export function entryPattern(a: string, op: string, b: string, result: string): RegExp {
  const n = (s: string): string => escape(s.replace(/[−–]/g, "-"));
  return new RegExp(
    `(?<![\\d.])${n(a)}\\s*${SYMBOLS[op] ?? escape(op)}\\s*${n(b)}\\s*=\\s*${n(result)}(?![\\d.])`,
  );
}

// Index of the first entry matching pattern, or -1.
export function entryIndex(root: HTMLElement, pattern: RegExp): number {
  return historyEntries(root).findIndex((e) => pattern.test(e.text));
}

export function expectEntryAt(root: HTMLElement, pattern: RegExp, index: number, context: string): void {
  const entries = historyEntries(root).map((e) => e.text);
  expect(
    entries.findIndex((e) => pattern.test(e)),
    `${context}: expected an entry ${pattern} at position ${index}, history showed: ${JSON.stringify(entries)}`,
  ).toBe(index);
}
