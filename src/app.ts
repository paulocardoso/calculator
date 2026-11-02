export type Operation = "add" | "subtract" | "multiply" | "divide" | "power" | "root";

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

// calculate applies op to a and b, returning an error instead of a value for
// division by zero, roots that have no real value, or a result too large to
// represent. 'power' is a to the power b and 'root' is the b-th root of a.
export function calculate(a: number, b: number, op: Operation): CalcResult {
  let value: number;
  switch (op) {
    case "add":
      value = a + b;
      break;
    case "subtract":
      value = a - b;
      break;
    case "multiply":
      value = a * b;
      break;
    case "divide":
      if (b === 0) return { ok: false, error: "Cannot divide by zero" };
      value = a / b;
      break;
    case "power":
      if (a === 0 && b < 0) return { ok: false, error: "Cannot divide by zero" };
      value = a ** b;
      break;
    case "root": {
      const result = nthRoot(a, b);
      if (!result.ok) return result;
      value = result.value;
      break;
    }
  }
  if (Number.isNaN(value)) return { ok: false, error: "Result is not a real number" };
  if (!Number.isFinite(value)) return { ok: false, error: "Result is too large to show" };
  return { ok: true, value };
}

// nthRoot returns the n-th root of a. Odd integer roots of negative numbers
// are real (the cube root of -8 is -2); other roots of negative numbers aren't.
function nthRoot(a: number, n: number): CalcResult {
  if (n === 0) return { ok: false, error: "Root degree cannot be zero" };
  if (a === 0 && n < 0) return { ok: false, error: "Cannot divide by zero" };
  if (a >= 0) return { ok: true, value: a ** (1 / n) };
  if (Number.isInteger(n) && n % 2 === 0) {
    return { ok: false, error: "Cannot take an even root of a negative number" };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, error: "Cannot take a fractional root of a negative number" };
  }
  return { ok: true, value: -((-a) ** (1 / n)) };
}

export type MathFunction = "sqrt" | "sin" | "cos" | "tan" | "log" | "ln";

const MATH_FUNCTIONS: readonly MathFunction[] = ["sqrt", "sin", "cos", "tan", "log", "ln"];

export function isMathFunction(op: string): op is MathFunction {
  return (MATH_FUNCTIONS as readonly string[]).includes(op);
}

// calculateFunction applies a single-number function to a. Angles for sin,
// cos and tan are in degrees.
export function calculateFunction(a: number, fn: MathFunction): CalcResult {
  let value: number;
  switch (fn) {
    case "sqrt":
      if (a < 0) return { ok: false, error: "Cannot take the square root of a negative number" };
      value = Math.sqrt(a);
      break;
    case "log":
    case "ln":
      if (a <= 0) return { ok: false, error: "Logarithm needs a positive number" };
      value = fn === "log" ? Math.log10(a) : Math.log(a);
      break;
    case "sin":
    case "cos":
    case "tan": {
      // Reduce the angle first so large angles stay accurate.
      const degrees = ((a % 360) + 360) % 360;
      if (fn === "tan" && degrees % 180 === 90) {
        return { ok: false, error: "Tangent is undefined for this angle" };
      }
      const radians = (degrees * Math.PI) / 180;
      value = fn === "sin" ? Math.sin(radians) : fn === "cos" ? Math.cos(radians) : Math.tan(radians);
      // sin(180) is 1.2e-16 in floating point; show it as 0.
      if (Math.abs(value) < 1e-12) value = 0;
      break;
    }
  }
  if (Number.isNaN(value)) return { ok: false, error: "Result is not a real number" };
  if (!Number.isFinite(value)) return { ok: false, error: "Result is too large to show" };
  return { ok: true, value };
}

// formatFunctionEntry describes a successful single-number calculation for
// the history panel, for example '√16 = 4' or 'sin(30) = 0.5'.
export function formatFunctionEntry(a: number, fn: MathFunction, value: number): string {
  const input = formatNumber(a);
  const call = fn === "sqrt" ? `√${input}` : `${fn}(${input})`;
  return `${call} = ${formatNumber(value)}`;
}

// parseOperand turns user input into a number, or undefined if it's empty or
// not a valid number.
export function parseOperand(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

// formatNumber trims floating point noise (0.1 + 0.2 shows 0.3).
export function formatNumber(n: number): string {
  const rounded = Number(n.toPrecision(12));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

const OPERATION_SYMBOLS: Record<Operation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  power: "^",
  root: "√",
};

// formatEntry describes a successful calculation for the history panel, for
// example '6 × 3 = 18' or '2 ^ 10 = 1024'. Roots read 'a √ b', for example
// '27 √ 3 = 3' for the cube root of 27.
export function formatEntry(a: number, b: number, op: Operation, value: number): string {
  return `${formatNumber(a)} ${OPERATION_SYMBOLS[op]} ${formatNumber(b)} = ${formatNumber(value)}`;
}

// mount renders the app into root. It's separate from main.ts so tests can
// render the app into a test document.
export function mount(root: HTMLElement): void {
  root.innerHTML = `
    <h1>calculator</h1>
    <form novalidate>
      <label>First number <input name="a" type="number" step="any" inputmode="decimal" /></label>
      <label>Operation
        <select name="op">
          <option value="add">Add</option>
          <option value="subtract">Subtract</option>
          <option value="multiply">Multiply</option>
          <option value="divide">Divide</option>
          <option value="power">Power</option>
          <option value="root">Root</option>
          <option value="sqrt">Square root</option>
          <option value="sin">Sine</option>
          <option value="cos">Cosine</option>
          <option value="tan">Tangent</option>
          <option value="log">Log (base 10)</option>
          <option value="ln">Natural log</option>
        </select>
      </label>
      <label class="second-number">Second number <input name="b" type="number" step="any" inputmode="decimal" /></label>
      <button type="submit">Calculate</button>
    </form>
    <p class="error" role="alert" hidden></p>
    <output class="result" hidden></output>
    <button type="button" class="history-toggle" aria-expanded="false">History</button>
    <section class="history" aria-label="History" hidden>
      <h2>History</h2>
      <p class="history-empty">No calculations yet</p>
      <ol class="history-list"></ol>
    </section>
  `;

  const form = root.querySelector("form")!;
  const inputA = form.querySelector<HTMLInputElement>('input[name="a"]')!;
  const inputB = form.querySelector<HTMLInputElement>('input[name="b"]')!;
  const select = form.querySelector("select")!;
  const secondLabel = form.querySelector<HTMLLabelElement>(".second-number")!;
  const errorEl = root.querySelector<HTMLParagraphElement>(".error")!;
  const resultEl = root.querySelector<HTMLOutputElement>(".result")!;
  const historyToggle = root.querySelector<HTMLButtonElement>(".history-toggle")!;
  const historyPanel = root.querySelector<HTMLElement>(".history")!;
  const historyEmpty = root.querySelector<HTMLParagraphElement>(".history-empty")!;
  const historyList = root.querySelector<HTMLOListElement>(".history-list")!;

  historyToggle.addEventListener("click", () => {
    historyPanel.hidden = !historyPanel.hidden;
    historyToggle.setAttribute("aria-expanded", String(!historyPanel.hidden));
  });

  // addToHistory puts the newest entry at the top of the list.
  const addToHistory = (entry: string): void => {
    const item = document.createElement("li");
    item.textContent = entry;
    historyList.prepend(item);
    historyEmpty.hidden = true;
  };

  const showError = (message: string): void => {
    resultEl.textContent = "";
    resultEl.hidden = true;
    errorEl.textContent = message;
    errorEl.hidden = false;
  };

  const showResult = (value: number): void => {
    errorEl.textContent = "";
    errorEl.hidden = true;
    resultEl.textContent = `Result: ${formatNumber(value)}`;
    resultEl.hidden = false;
  };

  // Single-number functions only use the first field, so hide the second.
  const updateSecondField = (): void => {
    secondLabel.hidden = isMathFunction(select.value);
  };
  select.addEventListener("change", updateSecondField);
  select.addEventListener("input", updateSecondField);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const a = parseOperand(inputA.value);
    const fn = select.value;
    if (isMathFunction(fn)) {
      if (a === undefined) {
        showError("Please enter a valid number in the first field");
        return;
      }
      const result = calculateFunction(a, fn);
      if (result.ok) {
        showResult(result.value);
        addToHistory(formatFunctionEntry(a, fn, result.value));
      } else {
        showError(result.error);
      }
      return;
    }
    const b = parseOperand(inputB.value);
    if (a === undefined || b === undefined) {
      showError("Please enter a valid number in both fields");
      return;
    }
    const op = select.value as Operation;
    const result = calculate(a, b, op);
    if (result.ok) {
      showResult(result.value);
      addToHistory(formatEntry(a, b, op, result.value));
    } else {
      showError(result.error);
    }
  });
}
