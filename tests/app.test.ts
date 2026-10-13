import { describe, expect, it } from "vitest";
import { calculate, formatNumber, mount, parseOperand } from "../src/app";

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
