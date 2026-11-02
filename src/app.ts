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
  power: "^",
  root: "√",
};

// formatEntry describes a successful calculation for the history panel, for
// example '6 × 3 = 18' or '2 ^ 10 = 1024'. Roots read 'a √ b', for example
// '27 √ 3 = 3' for the cube root of 27.
export function formatEntry(a: number, b: number, op: Operation, value: number): string {
  return `${formatNumber(a)} ${OPERATION_SYMBOLS[op]} ${formatNumber(b)} = ${formatNumber(value)}`;
}

// KEYPAD_HTML is the calculator's keys, laid out like the iPhone Calculator:
// the scientific and memory keys above the standard keypad. Each key names
// its action in data-key.
const KEYPAD_HTML = `
  <div class="keys keys-sci" role="group" aria-label="Scientific and memory keys">
    <button type="button" class="key key-memory" data-key="mc" aria-label="Memory clear">mc</button>
    <button type="button" class="key key-memory" data-key="mr" aria-label="Memory recall">mr</button>
    <button type="button" class="key key-memory" data-key="m+" aria-label="Memory plus">m+</button>
    <button type="button" class="key key-memory" data-key="m-" aria-label="Memory minus">m−</button>
    <button type="button" class="key key-fn" data-key="sqrt" aria-label="Square root">√</button>
    <button type="button" class="key key-fn" data-key="power" aria-label="Power">xʸ</button>
    <button type="button" class="key key-fn" data-key="root" aria-label="Root">ʸ√x</button>
    <button type="button" class="key key-fn" data-key="ln" aria-label="Natural log">ln</button>
    <button type="button" class="key key-fn" data-key="sin" aria-label="Sine">sin</button>
    <button type="button" class="key key-fn" data-key="cos" aria-label="Cosine">cos</button>
    <button type="button" class="key key-fn" data-key="tan" aria-label="Tangent">tan</button>
    <button type="button" class="key key-fn" data-key="log" aria-label="Log (base 10)">log</button>
  </div>
  <div class="keys keys-main" role="group" aria-label="Keypad">
    <button type="button" class="key key-util" data-key="clear" aria-label="All clear">AC</button>
    <button type="button" class="key key-util" data-key="sign" aria-label="Change sign">±</button>
    <button type="button" class="key key-util" data-key="percent" aria-label="Percent">%</button>
    <button type="button" class="key key-op" data-key="divide" aria-label="Divide">÷</button>
    <button type="button" class="key key-digit" data-key="7">7</button>
    <button type="button" class="key key-digit" data-key="8">8</button>
    <button type="button" class="key key-digit" data-key="9">9</button>
    <button type="button" class="key key-op" data-key="multiply" aria-label="Multiply">×</button>
    <button type="button" class="key key-digit" data-key="4">4</button>
    <button type="button" class="key key-digit" data-key="5">5</button>
    <button type="button" class="key key-digit" data-key="6">6</button>
    <button type="button" class="key key-op" data-key="subtract" aria-label="Minus">−</button>
    <button type="button" class="key key-digit" data-key="1">1</button>
    <button type="button" class="key key-digit" data-key="2">2</button>
    <button type="button" class="key key-digit" data-key="3">3</button>
    <button type="button" class="key key-op" data-key="add" aria-label="Plus">+</button>
    <button type="button" class="key key-digit key-zero" data-key="0">0</button>
    <button type="button" class="key key-digit" data-key="." aria-label="Decimal point">.</button>
    <button type="button" class="key key-op" data-key="equals" aria-label="Equals">=</button>
  </div>
`;

// mount renders the app into root. It's separate from main.ts so tests can
// render the app into a test document.
export function mount(root: HTMLElement): void {
  root.innerHTML = `
    <h1>calculator</h1>
    <div class="calculator">
      <div class="screen">
        <span class="memory-indicator" hidden></span>
        <output class="display" aria-live="polite">0</output>
      </div>
      <div class="keypad">${KEYPAD_HTML}</div>
      <button type="button" class="history-toggle" aria-expanded="false">History</button>
      <section class="history" aria-label="History" hidden>
        <h2>History</h2>
        <p class="history-empty">No calculations yet</p>
        <ol class="history-list"></ol>
      </section>
    </div>
  `;

  const displayEl = root.querySelector<HTMLOutputElement>(".display")!;
  const keypad = root.querySelector<HTMLDivElement>(".keypad")!;
  const memoryIndicator = root.querySelector<HTMLSpanElement>(".memory-indicator")!;
  const memoryPlus = keypad.querySelector<HTMLButtonElement>('[data-key="m+"]')!;
  const memoryMinus = keypad.querySelector<HTMLButtonElement>('[data-key="m-"]')!;
  const operatorKeys = Array.from(keypad.querySelectorAll<HTMLButtonElement>(".key-op"));
  const historyToggle = root.querySelector<HTMLButtonElement>(".history-toggle")!;
  const historyPanel = root.querySelector<HTMLElement>(".history")!;
  const historyEmpty = root.querySelector<HTMLParagraphElement>(".history-empty")!;
  const historyList = root.querySelector<HTMLOListElement>(".history-list")!;

  // entry is the number in the display as typed (it can be '1.' or '-0'),
  // and error replaces it while a calculation has failed.
  let entry = "0";
  let error: string | undefined;
  // accumulator and pendingOp are the first number and operation of a
  // calculation waiting for its second number.
  let accumulator = 0;
  let pendingOp: Operation | undefined;
  // awaitingOperand is true right after an operator key, before the second
  // number has been given. startNew is true while the next digit should
  // start a new number instead of extending the display (after a result).
  let awaitingOperand = false;
  let startNew = false;
  let memory = 0;

  const update = (): void => {
    displayEl.textContent = error ?? entry;
    displayEl.classList.toggle("is-error", error !== undefined);
    memoryPlus.disabled = error !== undefined;
    memoryMinus.disabled = error !== undefined;
    for (const k of operatorKeys) {
      const active = awaitingOperand && pendingOp === k.dataset.key;
      k.classList.toggle("is-active", active);
      if (k.dataset.key !== "equals") k.setAttribute("aria-pressed", String(active));
    }
  };

  const current = (): number => Number(entry);

  const showValue = (value: number): void => {
    entry = formatNumber(value);
    error = undefined;
    startNew = true;
    awaitingOperand = false;
  };

  // fail shows message instead of a number and drops any pending
  // calculation; the next digit starts a new entry.
  const fail = (message: string): void => {
    error = message;
    pendingOp = undefined;
    awaitingOperand = false;
    startNew = true;
  };

  // setMemory stores value and shows it, hiding the indicator while it's 0
  // (including floating point noise such as 0.1 + 0.2 − 0.3).
  const setMemory = (value: number): void => {
    memory = value;
    const shown = formatNumber(memory);
    memoryIndicator.textContent = `M: ${shown}`;
    memoryIndicator.hidden = shown === "0";
  };

  // addToHistory puts the newest entry at the top of the list, with a control
  // that stores the entry's result in memory.
  const addToHistory = (text: string, value: number): void => {
    const item = document.createElement("li");
    item.append(text, " ");
    const store = document.createElement("button");
    store.type = "button";
    store.className = "history-store";
    store.textContent = "Store in memory";
    store.addEventListener("click", () => setMemory(value));
    item.append(store);
    historyList.prepend(item);
    historyEmpty.hidden = true;
  };

  const inputDigit = (d: string): void => {
    if (error !== undefined || startNew) {
      entry = "0";
      error = undefined;
      startNew = false;
      awaitingOperand = false;
    }
    if (d === ".") {
      if (!entry.includes(".")) entry += ".";
    } else if (entry === "0") {
      entry = d;
    } else if (entry === "-0") {
      entry = `-${d}`;
    } else {
      entry += d;
    }
  };

  // finish works out the pending calculation, returning whether it worked.
  const finish = (): boolean => {
    const a = accumulator;
    const b = current();
    const op = pendingOp!;
    pendingOp = undefined;
    const result = calculate(a, b, op);
    if (!result.ok) {
      fail(result.error);
      return false;
    }
    showValue(result.value);
    addToHistory(formatEntry(a, b, op, result.value), result.value);
    return true;
  };

  const chooseOperation = (op: Operation): void => {
    if (error !== undefined) return;
    // With a second number given, work out the pending result first.
    if (pendingOp !== undefined && !awaitingOperand && !finish()) return;
    accumulator = current();
    pendingOp = op;
    awaitingOperand = true;
    startNew = true;
  };

  const equals = (): void => {
    if (error !== undefined) return;
    if (pendingOp === undefined) {
      startNew = true;
      return;
    }
    finish();
  };

  const applyFunction = (fn: MathFunction): void => {
    if (error !== undefined) return;
    const a = current();
    const result = calculateFunction(a, fn);
    if (!result.ok) {
      fail(result.error);
      return;
    }
    showValue(result.value);
    addToHistory(formatFunctionEntry(a, fn, result.value), result.value);
  };

  const clearAll = (): void => {
    entry = "0";
    error = undefined;
    pendingOp = undefined;
    awaitingOperand = false;
    startNew = false;
  };

  const toggleSign = (): void => {
    if (error !== undefined) return;
    if (awaitingOperand) {
      // Start the second number as a negative one.
      entry = "-0";
      awaitingOperand = false;
      startNew = false;
      return;
    }
    entry = entry.startsWith("-") ? entry.slice(1) : `-${entry}`;
  };

  // percent divides the displayed number by 100. It doesn't calculate or add
  // to the history.
  const percent = (): void => {
    if (error !== undefined) return;
    entry = formatNumber(current() / 100);
    awaitingOperand = false;
    startNew = true;
  };

  // backspace deletes the last typed character; results and errors stay.
  const backspace = (): void => {
    if (error !== undefined || startNew) return;
    entry = entry.slice(0, -1);
    if (entry === "" || entry === "-") entry = "0";
  };

  const pressKey = (name: string): void => {
    if (/^[0-9.]$/.test(name)) inputDigit(name);
    else if (isMathFunction(name)) applyFunction(name);
    else
      switch (name) {
        case "add":
        case "subtract":
        case "multiply":
        case "divide":
        case "power":
        case "root":
          chooseOperation(name);
          break;
        case "equals":
          equals();
          break;
        case "clear":
          clearAll();
          break;
        case "sign":
          toggleSign();
          break;
        case "percent":
          percent();
          break;
        case "backspace":
          backspace();
          break;
        case "m+":
        case "m-":
          if (error !== undefined) break;
          setMemory(name === "m+" ? memory + current() : memory - current());
          startNew = true;
          break;
        case "mr":
          showValue(memory);
          break;
        case "mc":
          setMemory(0);
          break;
      }
    update();
  };

  keypad.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-key]");
    if (button && !button.disabled) pressKey(button.dataset.key!);
  });

  // Clicking a button doesn't move focus to it, so Enter keeps meaning '='
  // after a click instead of pressing the last clicked button again.
  root.addEventListener("mousedown", (event) => {
    if ((event.target as Element).closest("button")) event.preventDefault();
  });

  historyToggle.addEventListener("click", () => {
    historyPanel.hidden = !historyPanel.hidden;
    historyToggle.setAttribute("aria-expanded", String(!historyPanel.hidden));
  });

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
    // A focused button keeps its own Enter behaviour.
    if (key === "Enter" && target instanceof HTMLButtonElement) return;

    let name: string | undefined;
    if (/^[0-9.]$/.test(key)) name = key;
    else if (Object.hasOwn(OPERATION_KEYS, key)) name = OPERATION_KEYS[key];
    else if (key === "Enter" || key === "=") name = "equals";
    else if (key === "Escape") name = "clear";
    else if (key === "Backspace") name = "backspace";
    else if (key === "%") name = "percent";
    if (name === undefined) return;
    event.preventDefault();
    pressKey(name);
  });

  update();
}
