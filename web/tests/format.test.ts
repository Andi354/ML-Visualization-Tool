import { describe, expect, it } from "vitest";
import { formatInt, formatNumber } from "../src/format";

describe("German number format", () => {
  it("uses a decimal comma", () => expect(formatNumber(412.8)).toBe("412,8"));
  it("groups thousands with a narrow space", () => {
    expect(formatInt(222264)).toBe("222 264");
    expect(formatNumber(1234567.25, 2)).toBe("1 234 567,25");
  });
  it("shows missing values as a dash", () => {
    expect(formatNumber(null)).toBe("–");
    expect(formatNumber(NaN)).toBe("–");
  });
  it("uses a real minus and no minus for zero", () => {
    expect(formatNumber(-2.2)).toBe("−2,2");
    expect(formatNumber(-0.01, 1)).toBe("0,0");
  });
});
