import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { display, expectDisplay, key, render, tap, useApp, visibleText, type Key } from "./keypad-helpers";

// Acceptance tests for the iPhone Calculator dark look and feel. The page's
// stylesheets (every .css file under src/ and public/, and any <style> in
// index.html) are loaded into the test document, and the keys and display are
// found the way a user would find them (see keypad-helpers.ts). Styles are
// read through getComputedStyle, so they can live in any stylesheet or be set
// from code; CSS custom properties (var(--x)) and @media rules that match a
// 1024×768 landscape screen are resolved by the helpers below.

useApp();

// ---------------------------------------------------------------------------
// Loading the page's stylesheets
// ---------------------------------------------------------------------------

type Fs = {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string, options: { recursive: true }): string[];
};

async function pageCss(): Promise<string> {
  const fs = (await import(/* @vite-ignore */ "node:fs" as string)) as Fs;
  const parts: string[] = [];
  if (fs.existsSync("index.html")) {
    const doc = new DOMParser().parseFromString(fs.readFileSync("index.html", "utf8"), "text/html");
    for (const s of Array.from(doc.querySelectorAll("style"))) parts.push(s.textContent ?? "");
  }
  for (const dir of ["src", "public"]) {
    if (!fs.existsSync(dir)) continue;
    const files = fs
      .readdirSync(dir, { recursive: true })
      .map((f) => String(f).replace(/\\/g, "/"))
      .filter((f) => f.endsWith(".css"))
      .sort();
    for (const f of files) parts.push(fs.readFileSync(`${dir}/${f}`, "utf8"));
  }
  return parts.join("\n");
}

// The test screen: a landscape screen like jsdom's default window.
const SCREEN = { width: 1024, height: 768 };

function mediaFeatureMatches(feature: string): boolean {
  const m = /^\(\s*([a-z-]+)\s*(?::\s*([^)]+?))?\s*\)$/i.exec(feature.trim());
  if (!m) return false;
  const name = m[1].toLowerCase();
  const value = (m[2] ?? "").trim().toLowerCase();
  const px = (v: string): number => {
    const n = parseFloat(v);
    return v.endsWith("em") ? n * 16 : n;
  };
  switch (name) {
    case "min-width":
      return SCREEN.width >= px(value);
    case "max-width":
      return SCREEN.width <= px(value);
    case "min-height":
      return SCREEN.height >= px(value);
    case "max-height":
      return SCREEN.height <= px(value);
    case "orientation":
      return value === "landscape";
    case "prefers-color-scheme":
      return value === "dark";
    case "hover":
      return value === "hover";
    case "pointer":
      return value === "fine";
    case "prefers-reduced-motion":
      return value === "no-preference";
    default:
      return false;
  }
}

function mediaQueryMatches(query: string): boolean {
  return query.split(",").some((q) => {
    let text = q.trim().toLowerCase();
    let negate = false;
    if (text.startsWith("not ")) {
      negate = true;
      text = text.slice(4);
    }
    text = text.replace(/^only\s+/, "");
    const result = text
      .split(/\s+and\s+/)
      .map((p) => p.trim())
      .filter((p) => p !== "")
      .every((p) => (p.startsWith("(") ? mediaFeatureMatches(p) : p === "all" || p === "screen"));
    return negate ? !result : result;
  });
}

// flattenRules writes out the rules that apply on the test screen, with
// matching @media and @supports blocks unwrapped (jsdom ignores them).
function flattenRules(rules: CSSRuleList): string {
  const out: string[] = [];
  for (const rule of Array.from(rules)) {
    const r = rule as CSSRule & { media?: MediaList; cssRules?: CSSRuleList; conditionText?: string };
    if (r.constructor.name === "CSSMediaRule" || (r.media && r.cssRules && !("selectorText" in r))) {
      const query = r.media?.mediaText ?? r.conditionText ?? "";
      if (mediaQueryMatches(query)) out.push(flattenRules(r.cssRules!));
    } else if (r.constructor.name === "CSSSupportsRule" && r.cssRules) {
      out.push(flattenRules(r.cssRules));
    } else {
      out.push(r.cssText);
    }
  }
  return out.join("\n");
}

// Custom properties set on :root or html are substituted into the CSS text,
// so shorthands such as 'background: var(--orange)' work too.
function substituteRootVariables(css: string): string {
  const vars = new Map<string, string>();
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(ruleRe)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (!selectors.some((s) => s === ":root" || s === "html")) continue;
    for (const decl of m[2].split(";")) {
      const d = /^\s*(--[\w-]+)\s*:\s*([\s\S]*?)\s*$/.exec(decl);
      if (d) vars.set(d[1], d[2].replace(/\s*!important$/, ""));
    }
  }
  let result = css;
  for (let i = 0; i < 10; i++) {
    const next = result.replace(/var\(\s*(--[\w-]+)\s*\)/g, (whole, name: string) => vars.get(name) ?? whole);
    if (next === result) break;
    result = next;
  }
  return result;
}

let injected: HTMLStyleElement | undefined;

beforeEach(async () => {
  const scratch = document.createElement("style");
  scratch.textContent = await pageCss();
  document.head.append(scratch);
  const flat = flattenRules(scratch.sheet!.cssRules);
  scratch.remove();
  injected = document.createElement("style");
  injected.textContent = substituteRootVariables(flat);
  document.head.append(injected);
});

afterEach(() => {
  injected?.remove();
  injected = undefined;
});

// ---------------------------------------------------------------------------
// Reading computed styles
// ---------------------------------------------------------------------------

function resolveVars(el: Element, value: string): string {
  let result = value;
  for (let i = 0; i < 10 && /var\(/.test(result); i++) {
    result = result.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name: string, fallback?: string) => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const v = getComputedStyle(node).getPropertyValue(name).trim();
        if (v !== "") return v;
      }
      return fallback?.trim() ?? "";
    });
  }
  return result.trim();
}

function style(el: Element, property: string): string {
  return resolveVars(el, getComputedStyle(el).getPropertyValue(property));
}

type Rgba = { r: number; g: number; b: number; a: number };

function parseColor(value: string): Rgba | undefined {
  const probe = document.createElement("span");
  document.body.append(probe);
  probe.style.color = "rgb(1, 2, 3)";
  probe.style.color = value;
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)$/.exec(computed);
  if (!m || (computed === "rgb(1, 2, 3)" && value.replace(/\s/g, "") !== "rgb(1,2,3)")) return undefined;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a: alpha };
}

function color(el: Element, property: string): Rgba | undefined {
  const value = style(el, property);
  if (value === "" || value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  return parseColor(value);
}

function show(c: Rgba | undefined): string {
  return c ? `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})` : "an unreadable color";
}

const opaque = (c: Rgba | undefined): c is Rgba => c !== undefined && c.a >= 0.95;
const level = (c: Rgba): number => (c.r + c.g + c.b) / 3;
const neutral = (c: Rgba): boolean => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) <= 20;

const isBlack = (c: Rgba | undefined): boolean => opaque(c) && c.r <= 20 && c.g <= 20 && c.b <= 20;
const isWhite = (c: Rgba | undefined): boolean => opaque(c) && c.r >= 235 && c.g >= 235 && c.b >= 235;
const isDarkGrey = (c: Rgba | undefined): boolean => opaque(c) && neutral(c) && level(c) >= 35 && level(c) <= 110;
const isLightGrey = (c: Rgba | undefined): boolean => opaque(c) && neutral(c) && level(c) >= 140 && level(c) <= 230;
// An iPhone-like orange such as #ff9f0a or #ff9500.
const isOrange = (c: Rgba | undefined): boolean =>
  opaque(c) && c.r >= 220 && c.g >= 100 && c.g <= 200 && c.b <= 90 && c.r - c.g >= 50 && c.g - c.b >= 50;

function background(el: Element): Rgba | undefined {
  return color(el, "background-color");
}

function textColor(el: Element): Rgba | undefined {
  return color(el, "color");
}

// lengthPx converts a computed length to pixels (rem and em as 16px).
function lengthPx(value: string): number | undefined {
  const m = /^(-?[\d.]+)(px|rem|em|pt)?$/.exec(value.trim());
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "rem":
    case "em":
      return n * 16;
    case "pt":
      return (n * 4) / 3;
    default:
      return n;
  }
}

// isFullyRounded checks every corner of el is rounded by at least half the
// key: 50% or more, at least half the key's declared width or height, or a
// pill radius of 100px or more.
function isFullyRounded(el: Element): boolean {
  const shorthand = style(el, "border-radius");
  const corners =
    shorthand !== ""
      ? [shorthand]
      : ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"].map((p) =>
          style(el, p),
        );
  const sizes = ["width", "height"].map((p) => lengthPx(style(el, p))).filter((n): n is number => n !== undefined && n > 0);
  const half = sizes.length > 0 ? Math.min(...sizes) / 2 : 100;
  return corners.every((corner) => {
    const values = corner.split(/[\s/]+/).filter((v) => v !== "");
    if (values.length === 0) return false;
    return values.every((v) => {
      if (v.endsWith("%")) return parseFloat(v) >= 50;
      const px = lengthPx(v);
      return px !== undefined && px >= Math.min(half, 100);
    });
  });
}

function label(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Grid layout, worked out from the computed grid properties
// ---------------------------------------------------------------------------

function splitTopLevel(text: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current !== "") tokens.push(current);
      current = "";
    } else current += ch;
  }
  if (current !== "") tokens.push(current);
  return tokens;
}

function trackCount(template: string): number {
  let count = 0;
  for (const token of splitTopLevel(template.trim())) {
    if (token.startsWith("[")) continue;
    const rep = /^repeat\(\s*([^,]+?)\s*,([\s\S]*)\)$/.exec(token);
    if (rep) {
      const times = Number(rep[1]);
      if (!Number.isInteger(times)) throw new Error(`can't work out the columns of 'grid-template-columns: ${template}'`);
      count += times * trackCount(rep[2]);
    } else count += 1;
  }
  return count;
}

function isGrid(el: Element): boolean {
  return /^(inline-)?grid$/.test(style(el, "display"));
}

function isFlex(el: Element): boolean {
  return /^(inline-)?flex$/.test(style(el, "display"));
}

function columnTemplate(grid: Element): number {
  let template = style(grid, "grid-template-columns");
  if (template === "" || template === "none") {
    const shorthand = style(grid, "grid-template") || style(grid, "grid");
    if (shorthand.includes("/")) template = shorthand.split("/").pop()!.trim();
  }
  if (template === "" || template === "none") return 1;
  return trackCount(template);
}

type Placement = { start: number; span: number; row: number };

// Elements with 'display: contents' don't take part in layout themselves:
// their children are laid out as children of the element's parent.
const isContents = (el: Element): boolean => style(el, "display") === "contents";

function layoutParent(el: Element): Element {
  let parent = el.parentElement!;
  while (isContents(parent)) parent = parent.parentElement!;
  return parent;
}

function layoutChildren(container: Element): Element[] {
  return Array.from(container.children).flatMap((c) => (isContents(c) ? layoutChildren(c) : [c]));
}

function laidOutChildren(container: Element): Element[] {
  const children = layoutChildren(container).filter(
    (c) => !(c instanceof HTMLElement && c.hidden) && style(c, "display") !== "none" && style(c, "position") !== "absolute" && style(c, "position") !== "fixed",
  );
  const order = (c: Element): number => Number(style(c, "order")) || 0;
  return children.map((c, i) => ({ c, i })).sort((a, b) => order(a.c) - order(b.c) || a.i - b.i).map((x) => x.c);
}

function columnPlacement(item: Element, columns: number): { start?: number; span: number } {
  let start = style(item, "grid-column-start");
  let end = style(item, "grid-column-end");
  const column = style(item, "grid-column");
  const area = style(item, "grid-area");
  if (column !== "") {
    const parts = column.split("/").map((p) => p.trim());
    start = parts[0];
    end = parts[1] ?? (/^\d+$/.test(parts[0]) || parts[0].startsWith("-") ? "auto" : "auto");
  } else if ((start === "" || start === "auto") && (end === "" || end === "auto") && area.includes("/")) {
    const parts = area.split("/").map((p) => p.trim());
    start = parts[1] ?? "auto";
    end = parts[3] ?? "auto";
  }
  const line = (v: string): number | undefined => {
    if (!/^-?\d+$/.test(v)) return undefined;
    const n = Number(v);
    return n > 0 ? n - 1 : columns + 1 + n - 1;
  };
  const spanOf = (v: string): number | undefined => {
    const m = /^span\s+(\d+)$/.exec(v ?? "");
    return m ? Number(m[1]) : undefined;
  };
  const s = line(start ?? "auto");
  const e = line(end ?? "auto");
  const sSpan = spanOf(start ?? "");
  const eSpan = spanOf(end ?? "");
  if (s !== undefined && e !== undefined) return { start: Math.min(s, e), span: Math.max(1, Math.abs(e - s)) };
  if (s !== undefined) return { start: s, span: eSpan ?? 1 };
  if (e !== undefined) {
    const span = sSpan ?? 1;
    return { start: Math.max(0, e - span), span };
  }
  return { span: sSpan ?? eSpan ?? 1 };
}

// gridPlacements works out which columns the grid's items are placed in
// with the CSS grid auto-placement algorithm (row by row).
function gridPlacements(grid: Element): Map<Element, Placement> {
  const flow = style(grid, "grid-auto-flow");
  if (flow.includes("column")) throw new Error("can't work out a column-flow grid's layout");
  const items = laidOutChildren(grid);
  const placements = items.map((item) => ({ item, ...columnPlacement(item, columnTemplate(grid)) }));
  const columns = Math.max(columnTemplate(grid), ...placements.map((p) => (p.start ?? 0) + p.span));
  const taken = new Set<string>();
  const free = (row: number, start: number, span: number): boolean => {
    for (let c = start; c < start + span; c++) if (taken.has(`${row}:${c}`)) return false;
    return start + span <= columns;
  };
  const result = new Map<Element, Placement>();
  let row = 0;
  let col = 0;
  for (const p of placements) {
    let placeRow = row;
    let placeCol: number;
    if (p.start !== undefined) {
      if (p.start < col) placeRow++;
      while (!free(placeRow, p.start, p.span)) placeRow++;
      placeCol = p.start;
    } else {
      placeCol = col;
      while (!free(placeRow, placeCol, Math.min(p.span, columns))) {
        placeCol++;
        if (placeCol + Math.min(p.span, columns) > columns) {
          placeCol = 0;
          placeRow++;
        }
      }
    }
    for (let c = placeCol; c < placeCol + p.span; c++) taken.add(`${placeRow}:${c}`);
    result.set(p.item, { start: placeCol, span: p.span, row: placeRow });
    row = placeRow;
    col = placeCol + p.span;
  }
  return result;
}

// isLeftOf checks a is laid out to the left of b, both being children of
// container: side by side in a row flexbox, or in earlier grid columns.
function isLeftOf(a: Element, b: Element, container: Element): boolean {
  if (isFlex(container)) {
    const direction = style(container, "flex-direction") || "row";
    if (!direction.startsWith("row")) return false;
    const order = laidOutChildren(container);
    const before = order.indexOf(a) < order.indexOf(b);
    return direction === "row-reverse" ? !before : before;
  }
  if (isGrid(container)) {
    const placements = gridPlacements(container);
    const pa = placements.get(a);
    const pb = placements.get(b);
    return pa !== undefined && pb !== undefined && pa.start + pa.span <= pb.start;
  }
  return false;
}

function childContaining(ancestor: Element, el: Element): Element {
  let node = el;
  while (layoutParent(node) !== ancestor) node = layoutParent(node);
  return node;
}

function commonAncestor(a: Element, b: Element): Element {
  let node: Element = layoutParent(a);
  while (!node.contains(b)) node = layoutParent(node);
  return node;
}

// ---------------------------------------------------------------------------

const DIGIT_KEYS: Key[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."];
const OPERATOR_KEYS: Key[] = ["÷", "×", "−", "+"];
const UTILITY_KEYS: Key[] = ["AC", "±", "%"];
const MAIN_KEYS: Key[] = [...UTILITY_KEYS, ...OPERATOR_KEYS, "=", ...DIGIT_KEYS];
const SCIENTIFIC_KEYS: Key[] = ["mc", "mr", "m+", "m−", "√", "xʸ", "ʸ√x", "ln", "sin", "cos", "tan", "log"];

function displayElement(root: HTMLElement): HTMLElement {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
    (el) => !el.querySelector("*") && !el.closest("button") && visibleText(el) === display(root),
  );
  expect(candidates.length, `expected one element showing the display's '${display(root)}'`).toBeGreaterThanOrEqual(1);
  return candidates[0];
}

function expectPressed(op: HTMLElement, context: string): void {
  expect(op.getAttribute("aria-pressed"), `${context}: expected '${label(op)}' to have aria-pressed=true`).toBe("true");
  expect(isWhite(background(op)), `${context}: expected '${label(op)}' to be white, it was ${show(background(op))}`).toBe(true);
  expect(isOrange(textColor(op)), `${context}: expected '${label(op)}' to have orange text, it was ${show(textColor(op))}`).toBe(true);
}

function expectNotPressed(op: HTMLElement, context: string): void {
  expect(op.getAttribute("aria-pressed"), `${context}: expected '${label(op)}' not to be pressed`).not.toBe("true");
  expect(isOrange(background(op)), `${context}: expected '${label(op)}' to be orange again, it was ${show(background(op))}`).toBe(true);
  expect(isWhite(textColor(op)), `${context}: expected '${label(op)}' to have white text, it was ${show(textColor(op))}`).toBe(true);
}

function expectNoOperatorPressed(root: HTMLElement, context: string): void {
  for (const k of OPERATOR_KEYS) expectNotPressed(key(root, k), context);
}

function clearKey(root: HTMLElement): HTMLElement {
  return key(root, "AC");
}

describe("iPhone dark theme", () => {
  it("uses a black background, the system font and a large white right-aligned number in the display", async () => {
    const root = render();
    await tap(root, "1", "2", "3");
    const shown = displayElement(root);

    // The page is black: the canvas, and nothing between it and the display
    // paints another color.
    const html = document.documentElement;
    const canvas = background(html)!.a > 0 ? background(html) : background(document.body);
    expect(isBlack(canvas), `expected a black page background, it was ${show(canvas)}`).toBe(true);
    for (let node: Element | null = shown; node && node !== html; node = node.parentElement) {
      const bg = background(node);
      expect(
        bg !== undefined && (bg.a === 0 || isBlack(bg)),
        `expected nothing behind the display to paint a color other than black, <${node.tagName.toLowerCase()} class="${node.className}"> was ${show(bg)}`,
      ).toBe(true);
    }

    // The system font stack.
    for (const el of [shown, key(root, "7")]) {
      const families = style(el, "font-family")
        .split(",")
        .map((f) => f.trim().replace(/^["']|["']$/g, "").toLowerCase());
      expect(
        families.some((f) => f === "-apple-system" || f.startsWith("sf pro")),
        `expected the -apple-system / SF Pro font stack on '${label(el)}', it was '${style(el, "font-family")}'`,
      ).toBe(true);
      expect(
        ["-apple-system", "system-ui", "blinkmacsystemfont"].includes(families[0]) || families[0].startsWith("sf pro"),
        `expected the font stack on '${label(el)}' to start with the system font, it was '${style(el, "font-family")}'`,
      ).toBe(true);
    }

    // A large, white, right-aligned number.
    const size = lengthPx(style(shown, "font-size"));
    expect(size, `expected the display's font size to be at least 48px, it was '${style(shown, "font-size")}'`).toBeGreaterThanOrEqual(48);
    expect(isWhite(textColor(shown)), `expected the display's number to be white, it was ${show(textColor(shown))}`).toBe(true);
    const align = style(shown, "text-align");
    const justify = style(shown, "justify-content");
    expect(
      ["right", "end", "-webkit-right"].includes(align) || (isFlex(shown) && ["flex-end", "end", "right"].includes(justify)),
      `expected the display's number to be right-aligned, text-align was '${align}'`,
    ).toBe(true);
  });

  it("has round keys: dark grey digits with white text, orange operators and = with white text, light grey AC ± and % with black text", () => {
    const root = render();
    for (const k of [...MAIN_KEYS, ...SCIENTIFIC_KEYS]) {
      const el = key(root, k);
      expect(isFullyRounded(el), `expected the '${k}' key to be fully rounded, its border-radius was '${style(el, "border-radius")}'`).toBe(true);
    }
    for (const k of DIGIT_KEYS) {
      const el = key(root, k);
      expect(isDarkGrey(background(el)), `expected the '${k}' key to be dark grey, it was ${show(background(el))}`).toBe(true);
      expect(isWhite(textColor(el)), `expected the '${k}' key to have white text, it was ${show(textColor(el))}`).toBe(true);
    }
    for (const k of [...OPERATOR_KEYS, "="] as Key[]) {
      const el = key(root, k);
      expect(isOrange(background(el)), `expected the '${k}' key to be orange, it was ${show(background(el))}`).toBe(true);
      expect(isWhite(textColor(el)), `expected the '${k}' key to have white text, it was ${show(textColor(el))}`).toBe(true);
    }
    for (const k of UTILITY_KEYS) {
      const el = key(root, k);
      expect(isLightGrey(background(el)), `expected the '${k}' key to be light grey, it was ${show(background(el))}`).toBe(true);
      expect(isBlack(textColor(el)), `expected the '${k}' key to have black text, it was ${show(textColor(el))}`).toBe(true);
    }
  });

  it("lays out a 4-column main keypad with a two-column 0, and the scientific and memory keys in darker grey columns to its left", () => {
    const root = render();
    const seven = key(root, "7");
    const grid = layoutParent(seven);
    expect(isGrid(grid), "expected the main keypad to be laid out as a grid").toBe(true);
    for (const k of MAIN_KEYS) {
      expect(layoutParent(key(root, k)), `expected the '${k}' key in the main keypad with 7`).toBe(grid);
    }
    const placements = gridPlacements(grid);
    const mainColumns = new Set<number>();
    for (const k of MAIN_KEYS) {
      const p = placements.get(key(root, k))!;
      for (let c = p.start; c < p.start + p.span; c++) mainColumns.add(c);
    }
    const sorted = [...mainColumns].sort((a, b) => a - b);
    expect(sorted.length, `expected the main keypad to have 4 columns, it used columns ${sorted.join(", ")}`).toBe(4);
    expect(sorted[3] - sorted[0], "expected the main keypad's 4 columns to be next to each other").toBe(3);
    const zero = placements.get(key(root, "0"))!;
    expect(zero.span, "expected the 0 key to span two columns").toBe(2);
    const dot = placements.get(key(root, "."))!;
    expect(dot.row, "expected the 0 key on the same row as '.'").toBe(zero.row);
    expect(zero.start + 2, "expected the 0 key's two columns just left of '.'").toBe(dot.start);
    if (!placements.has(key(root, "sin"))) {
      expect(columnTemplate(grid), "expected the main keypad's grid to have 4 columns").toBe(4);
    }

    const digitGrey = level(background(seven)!);
    const pageBg = background(document.documentElement)!.a > 0 ? background(document.documentElement)! : background(document.body)!;
    const sciColumns = new Set<string>();
    const sciGrids: Element[] = [];
    for (const k of SCIENTIFIC_KEYS) {
      const el = key(root, k);
      const parent = layoutParent(el);
      expect(isGrid(parent), `expected the '${k}' key to sit in a column of a grid`).toBe(true);
      if (!sciGrids.includes(parent)) sciGrids.push(parent);
      const p = gridPlacements(parent).get(el)!;
      sciColumns.add(`${sciGrids.indexOf(parent)}:${p.start}`);
      if (parent === grid) {
        expect(p.start + p.span, `expected the '${k}' key in a column left of the main keypad`).toBeLessThanOrEqual(sorted[0]);
      } else {
        const container = commonAncestor(el, grid);
        expect(
          isLeftOf(childContaining(container, el), childContaining(container, grid), container),
          `expected the '${k}' key to be laid out to the left of the main keypad`,
        ).toBe(true);
      }
      const bg = background(el);
      expect(
        opaque(bg) && neutral(bg) && level(bg) < digitGrey && level(bg) >= level(pageBg) + 8,
        `expected the '${k}' key to be a grey darker than the digit keys (${show(background(seven))}) but not black, it was ${show(bg)}`,
      ).toBe(true);
    }
    expect(sciColumns.size, "expected the scientific and memory keys to fill more than one column").toBeGreaterThanOrEqual(2);
  });

  it("highlights a pending operator in white with orange text and aria-pressed=true until a digit, = or AC is pressed", async () => {
    const root = render();
    expectNoOperatorPressed(root, "when the app starts");

    // A digit ends the highlight.
    await tap(root, "6", "×");
    expectPressed(key(root, "×"), "6 ×");
    for (const k of ["÷", "−", "+"] as Key[]) expectNotPressed(key(root, k), "6 ×");
    await tap(root, "3");
    expectNoOperatorPressed(root, "6 × 3");

    // = ends it.
    await tap(root, "+");
    expectPressed(key(root, "+"), "6 × 3 +");
    await tap(root, "2", "−");
    expectPressed(key(root, "−"), "6 × 3 + 2 −");
    await tap(root, "=");
    expectNoOperatorPressed(root, "6 × 3 + 2 − =");

    // AC ends it (pressing C first if the key reads C).
    await tap(root, "AC");
    await tap(root, "8", "÷");
    expectPressed(key(root, "÷"), "8 ÷");
    if (label(clearKey(root)) === "C") await tap(root, "AC");
    expect(label(clearKey(root)), "expected the clear key to read AC").toBe("AC");
    await tap(root, "AC");
    expectNoOperatorPressed(root, "8 ÷ AC");
    expectDisplay(root, "0", "8 ÷ AC");
  });

  it("AC reads C once a number has been typed and clears only the current entry; pressed again, now reading AC, it clears everything", async () => {
    const root = render();
    expect(label(clearKey(root)), "when the app starts").toBe("AC");
    await tap(root, "1", "2");
    expect(label(clearKey(root)), "after typing 12").toBe("C");
    await tap(root, "AC");
    expectDisplay(root, "0", "12 C");
    expect(label(clearKey(root)), "after C").toBe("AC");

    // C clears only the number being typed; the pending 6 × stays.
    await tap(root, "AC", "6", "×", "3");
    expect(label(clearKey(root)), "after typing 6 × 3").toBe("C");
    await tap(root, "AC");
    expectDisplay(root, "0", "6 × 3 C");
    expect(label(clearKey(root)), "after 6 × 3 C").toBe("AC");
    await tap(root, "4", "=");
    expectDisplay(root, "24", "6 × 3 C 4 =");

    // A second press, reading AC, clears everything, including 6 ×.
    await tap(root, "AC", "6", "×", "3", "AC");
    expect(label(clearKey(root)), "after 6 × 3 C").toBe("AC");
    await tap(root, "AC");
    expectDisplay(root, "0", "6 × 3 C AC");
    expect(label(clearKey(root)), "after 6 × 3 C AC").toBe("AC");
    await tap(root, "4", "=");
    expectDisplay(root, "4", "6 × 3 C AC 4 =");
  });
});
