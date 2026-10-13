export type Operation = "add" | "subtract" | "multiply" | "divide";

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

// calculate applies op to a and b, returning an error instead of a value for
// division by zero or a result too large to represent.
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
  }
  if (!Number.isFinite(value)) return { ok: false, error: "Result is too large to show" };
  return { ok: true, value };
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
        </select>
      </label>
      <label>Second number <input name="b" type="number" step="any" inputmode="decimal" /></label>
      <button type="submit">Calculate</button>
    </form>
    <p class="error" role="alert" hidden></p>
    <output class="result" hidden></output>
  `;

  const form = root.querySelector("form")!;
  const inputA = form.querySelector<HTMLInputElement>('input[name="a"]')!;
  const inputB = form.querySelector<HTMLInputElement>('input[name="b"]')!;
  const select = form.querySelector("select")!;
  const errorEl = root.querySelector<HTMLParagraphElement>(".error")!;
  const resultEl = root.querySelector<HTMLOutputElement>(".result")!;

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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const a = parseOperand(inputA.value);
    const b = parseOperand(inputB.value);
    if (a === undefined || b === undefined) {
      showError("Please enter a valid number in both fields");
      return;
    }
    const result = calculate(a, b, select.value as Operation);
    if (result.ok) showResult(result.value);
    else showError(result.error);
  });
}
