import { describe, it, expect } from "vitest";
import { headerLooksLikeCode, isExactHeaderMatch } from "./mappingDisplay";

describe("headerLooksLikeCode", () => {
  it("treats ALL CAPS and snake_case headers as code", () => {
    expect(headerLooksLikeCode("SIS_ID")).toBe(true);
    expect(headerLooksLikeCode("EMP NO")).toBe(true);
    expect(headerLooksLikeCode("external_id")).toBe(true);
    expect(headerLooksLikeCode("E-MAIL")).toBe(true);
  });

  it("treats normal words as prose", () => {
    expect(headerLooksLikeCode("First name")).toBe(false);
    expect(headerLooksLikeCode("Emp #")).toBe(false);
    expect(headerLooksLikeCode("Work E-mail")).toBe(false);
    expect(headerLooksLikeCode("")).toBe(false);
    expect(headerLooksLikeCode("2024")).toBe(false);
  });
});

describe("isExactHeaderMatch", () => {
  const field = { key: "workEmail", label: "Work Email", type: "email" as const };

  it("ignores case and punctuation when comparing to the label or key", () => {
    expect(isExactHeaderMatch("Work E-mail", field)).toBe(true);
    expect(isExactHeaderMatch("work_email", field)).toBe(true);
    expect(isExactHeaderMatch("WORK EMAIL", field)).toBe(true);
  });

  it("is false for similar but different headers", () => {
    expect(isExactHeaderMatch("Mgr E-mail", field)).toBe(false);
    expect(isExactHeaderMatch("Email", field)).toBe(false);
    expect(isExactHeaderMatch("", field)).toBe(false);
  });
});
