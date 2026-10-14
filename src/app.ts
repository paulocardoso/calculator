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

// OPERATION_KEYS maps the keys that choose an operation from the keyboard.
const OPERATION_KEYS: Record<string, Operation> = {
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
};

const OPERATION_SYMBOLS: Record<Operation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
};

// formatEntry describes a successful calculation for the history panel, for
// example '6 × 3 = 18'.
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
        </select>
      </label>
      <label>Second number <input name="b" type="number" step="any" inputmode="decimal" /></label>
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

  const clear = (): void => {
    inputA.value = "";
    inputB.value = "";
    typedText.delete(inputA);
    typedText.delete(inputB);
    errorEl.textContent = "";
    errorEl.hidden = true;
    resultEl.textContent = "";
    resultEl.hidden = true;
    operationChosen = false;
    inputA.focus();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const a = parseOperand(inputA.value);
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

  // Keyboard support. Digits typed with focus outside the number fields go to
  // the active field: the first one until an operation has been chosen, then
  // the second one.
  let operationChosen = false;
  select.addEventListener("change", () => {
    operationChosen = true;
  });

  // A number field's value is "" while its text isn't a valid number yet (for
  // example "1."), so the text typed from outside the field is remembered
  // until the field changes some other way.
  const typedText = new Map<HTMLInputElement, { text: string; value: string }>();
  let appending = false;
  for (const input of [inputA, inputB]) {
    input.addEventListener("input", () => {
      if (!appending) typedText.delete(input);
    });
  }

  const append = (input: HTMLInputElement, key: string): void => {
    const state = typedText.get(input);
    const current = state && state.value === input.value ? state.text : input.value;
    const text = current + key;
    input.value = text;
    typedText.set(input, { text, value: input.value });
    appending = true;
    try {
      input.dispatchEvent(
        new InputEvent("input", { bubbles: true, data: key, inputType: "insertText" }),
      );
    } finally {
      appending = false;
    }
  };

  const isEditable = (el: Element): boolean =>
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable) ||
    (el instanceof HTMLInputElement &&
      !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image"].includes(el.type));

  document.addEventListener("keydown", (event) => {
    // Ignore keys once the app is gone, keys other code has handled and
    // shortcuts with modifiers.
    if (!root.isConnected || event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    // Only react to keys in the app, or with focus on nothing in particular.
    const inApp = root.contains(target);
    if (!inApp && target !== document.body && target !== document.documentElement) return;
    const key = event.key;

    if (key === "Escape") {
      event.preventDefault();
      clear();
      return;
    }

    if (key === "Enter") {
      // Buttons keep their own Enter behaviour (the Calculate button submits).
      if (target instanceof HTMLButtonElement) return;
      event.preventDefault();
      form.requestSubmit();
      return;
    }

    const op = OPERATION_KEYS[key];
    const inFirstOrOutside = target === inputA || !isEditable(target);
    if (op && inFirstOrOutside && parseOperand(inputA.value) !== undefined) {
      event.preventDefault();
      select.value = op;
      operationChosen = true;
      inputB.focus();
      return;
    }

    if (/^[0-9.]$/.test(key) && !isEditable(target)) {
      event.preventDefault();
      append(operationChosen ? inputB : inputA, key);
    }
  });
}
