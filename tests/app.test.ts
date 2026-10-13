import { describe, expect, it } from "vitest";
import { mount } from "../src/app";

describe("app", () => {
  it("renders", () => {
    const root = document.createElement("div");
    mount(root);
    expect(root.querySelector("h1")?.textContent).toBe("calculator");
  });
});
