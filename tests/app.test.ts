import { describe, expect, it } from "vitest";
import { calculate, calculateFunction, formatNumber, mount, parseOperand } from "../src/app";

describe("app", () => {
  it("renders", () => {
    const root = document.createElement("div");
    mount(root);
    expect(root.querySelector("h1")?.textContent).toBe("calculator");
  });
});

describe("calculate", () => {
  it("returns an error for division by zero", () => {
    expect(calculate(1, 0, "divide")).toEqual({ ok: false, error: "Cannot divide by zero" });
  });

  it("returns an error when the result overflows", () => {
    expect(calculate(1e308, 10, "multiply").ok).toBe(false);
  });
});

describe("parseOperand", () => {
  it("rejects empty and non-numeric input", () => {
    expect(parseOperand("")).toBeUndefined();
    expect(parseOperand("  ")).toBeUndefined();
    expect(parseOperand("abc")).toBeUndefined();
    expect(parseOperand("-1.5")).toBe(-1.5);
  });
});

describe("formatNumber", () => {
  it("hides floating point noise", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(-0)).toBe("0");
  });
});

describe("calculateFunction", () => {
  it("shows exact values for common angles", () => {
    expect(calculateFunction(180, "sin")).toEqual({ ok: true, value: 0 });
    expect(calculateFunction(90, "cos")).toEqual({ ok: true, value: 0 });
    expect(calculateFunction(-90, "tan").ok).toBe(false);
    expect(calculateFunction(450, "tan").ok).toBe(false);
  });
});
