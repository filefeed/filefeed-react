import { describe, it, expect } from "vitest";
import {
  validateFieldWithRegistry,
  transformValue,
  generateAutoMapping,
  processImportedDataWithMappings,
  defaultTransforms,
  applyNamedTransform,
  mappingStateToFieldMappings,
  fieldMappingsToMappingState,
  validatePipelineConfig,
  collectHeaderSamples,
  applyAiColumnMappings,
  getUnmappedRequiredFields,
  unmappedRequiredMessage,
  processRowBatch,
} from "./dataProcessing";
import type { FieldConfig, ImportedData, PipelineMappings } from "../types";

describe("transformValue", () => {
  it("trims strings", () => {
    expect(transformValue("  hello  ", "string")).toBe("hello");
  });

  it("converts to number", () => {
    expect(transformValue("42", "number")).toBe(42);
  });

  it("converts boolean truthy values", () => {
    expect(transformValue("yes", "boolean")).toBe(true);
    expect(transformValue("1", "boolean")).toBe(true);
    expect(transformValue("true", "boolean")).toBe(true);
  });

  it("converts boolean falsy values", () => {
    expect(transformValue("no", "boolean")).toBe(false);
    expect(transformValue("0", "boolean")).toBe(false);
    expect(transformValue("false", "boolean")).toBe(false);
  });

  it("passes through null/undefined/empty", () => {
    expect(transformValue(null, "string")).toBeNull();
    expect(transformValue(undefined, "number")).toBeUndefined();
    expect(transformValue("", "boolean")).toBe("");
  });

  it("converts valid date strings to ISO", () => {
    const result = transformValue("2024-01-15", "date");
    expect(result).toContain("2024-01-15");
  });

  it("returns original for invalid date strings", () => {
    expect(transformValue("not-a-date", "date")).toBe("not-a-date");
  });
});

describe("defaultTransforms", () => {
  it("toLowerCase works", () => {
    expect(defaultTransforms.toLowerCase("HELLO")).toBe("hello");
  });

  it("toUpperCase works", () => {
    expect(defaultTransforms.toUpperCase("hello")).toBe("HELLO");
  });

  it("capitalize works", () => {
    expect(defaultTransforms.capitalize("john doe")).toBe("John Doe");
  });

  it("trim works", () => {
    expect(defaultTransforms.trim("  hi  ")).toBe("hi");
  });

  it("toNumber works", () => {
    expect(defaultTransforms.toNumber("42")).toBe(42);
    expect(defaultTransforms.toNumber("")).toBeNull();
    expect(defaultTransforms.toNumber(null)).toBeNull();
  });

  it("formatPhoneNumber strips non-digits", () => {
    expect(defaultTransforms.formatPhoneNumber("+1 (555) 123-4567")).toBe("15551234567");
  });

  it("formatEmail normalizes", () => {
    expect(defaultTransforms.formatEmail("  John@Example.COM  ")).toBe("john@example.com");
  });

  it("handles null values gracefully", () => {
    expect(defaultTransforms.toLowerCase(null)).toBeNull();
    expect(defaultTransforms.trim(undefined)).toBeUndefined();
  });
});

describe("applyNamedTransform", () => {
  it("applies named transform from registry", () => {
    expect(applyNamedTransform("hello", "toUpperCase", defaultTransforms)).toBe("HELLO");
  });

  it("returns original if transform not found", () => {
    expect(applyNamedTransform("hello", "nonexistent", defaultTransforms)).toBe("hello");
  });

  it("returns original if no transform name", () => {
    expect(applyNamedTransform("hello", undefined, defaultTransforms)).toBe("hello");
  });

  it("catches and returns original on transform error", () => {
    const badRegistry = { boom: () => { throw new Error("fail"); } };
    expect(applyNamedTransform("hello", "boom", badRegistry)).toBe("hello");
  });
});

describe("validateFieldWithRegistry", () => {
  const makeField = (overrides: Partial<FieldConfig> = {}): FieldConfig => ({
    key: "test",
    label: "Test",
    type: "string",
    ...overrides,
  });

  it("returns error for required empty field", () => {
    const errors = validateFieldWithRegistry("", makeField({ required: true }), 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("required");
  });

  it("returns no errors for valid string", () => {
    const errors = validateFieldWithRegistry("hello", makeField(), 0);
    expect(errors).toHaveLength(0);
  });

  it("validates number type", () => {
    const errors = validateFieldWithRegistry("abc", makeField({ type: "number" }), 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("number");
  });

  it("validates email type", () => {
    const errors = validateFieldWithRegistry("not-email", makeField({ type: "email" }), 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("email");
  });

  it("accepts valid email", () => {
    const errors = validateFieldWithRegistry("test@example.com", makeField({ type: "email" }), 0);
    expect(errors).toHaveLength(0);
  });

  it("validates date type", () => {
    const errors = validateFieldWithRegistry("not-a-date", makeField({ type: "date" }), 0);
    expect(errors).toHaveLength(1);
  });

  it("validates boolean type", () => {
    const errors = validateFieldWithRegistry("maybe", makeField({ type: "boolean" }), 0);
    expect(errors).toHaveLength(1);
  });

  it("validates regex rules", () => {
    const field = makeField({
      validations: [{ type: "regex", value: "^[A-Z]+$", message: "Must be uppercase" }],
    });
    const errors = validateFieldWithRegistry("hello", field, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("Must be uppercase");
  });

  it("handles invalid regex gracefully", () => {
    const field = makeField({
      validations: [{ type: "regex", value: "[invalid", message: "Bad regex" }],
    });
    const errors = validateFieldWithRegistry("hello", field, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Invalid regex");
  });

  it("validates min for numbers", () => {
    const field = makeField({
      type: "number",
      validations: [{ type: "min", value: 10, message: "Must be >= 10" }],
    });
    const errors = validateFieldWithRegistry(5, field, 0);
    expect(errors).toHaveLength(1);
  });

  it("validates max for strings (length)", () => {
    const field = makeField({
      validations: [{ type: "max", value: 3, message: "Too long" }],
    });
    const errors = validateFieldWithRegistry("hello", field, 0);
    expect(errors).toHaveLength(1);
  });

  it("calls custom validation from registry", () => {
    const field = makeField({
      validations: [{ type: "custom", name: "isEven", message: "Must be even" }],
    });
    const registry: Record<string, (...args: unknown[]) => string | false | null> = {
      isEven: (val: unknown) => Number(val) % 2 === 0 ? null : false,
    };
    expect(validateFieldWithRegistry(3, field, 0, {}, registry)).toHaveLength(1);
    expect(validateFieldWithRegistry(4, field, 0, {}, registry)).toHaveLength(0);
  });
});

describe("generateAutoMapping", () => {
  const fields: FieldConfig[] = [
    { key: "first_name", label: "First Name", type: "string" },
    { key: "last_name", label: "Last Name", type: "string" },
    { key: "email", label: "Email", type: "email" },
  ];

  it("maps exact matches", () => {
    const mapping = generateAutoMapping(["First Name", "Last Name", "Email"], fields);
    expect(mapping["First Name"]).toBe("first_name");
    expect(mapping["Last Name"]).toBe("last_name");
    expect(mapping["Email"]).toBe("email");
  });

  it("maps close matches", () => {
    const mapping = generateAutoMapping(["first name", "lastname", "email address"], fields);
    expect(mapping["first name"]).toBe("first_name");
    expect(mapping["lastname"]).toBe("last_name");
  });

  it("returns null for unmatched headers", () => {
    const mapping = generateAutoMapping(["xyz_unknown"], fields);
    expect(mapping["xyz_unknown"]).toBeNull();
  });

  it("does not double-assign fields", () => {
    const mapping = generateAutoMapping(["Name", "Name2"], [
      { key: "name", label: "Name", type: "string" },
    ]);
    const assigned = Object.values(mapping).filter(Boolean);
    expect(assigned.length).toBeLessThanOrEqual(1);
  });
});

describe("mappingStateToFieldMappings / fieldMappingsToMappingState", () => {
  it("round-trips correctly", () => {
    const state = { col1: "field1", col2: "field2", col3: null };
    const fm = mappingStateToFieldMappings(state);
    expect(fm).toHaveLength(2);
    const back = fieldMappingsToMappingState(fm);
    expect(back["col1"]).toBe("field1");
    expect(back["col2"]).toBe("field2");
  });
});

describe("validatePipelineConfig", () => {
  const fields: FieldConfig[] = [
    { key: "name", label: "Name", type: "string", required: true },
    { key: "age", label: "Age", type: "number" },
  ];

  it("reports missing required fields", () => {
    const pipeline: PipelineMappings = { fieldMappings: [{ source: "a", target: "age" }] };
    const errors = validatePipelineConfig(fields, pipeline);
    expect(errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("reports unknown transforms", () => {
    const pipeline: PipelineMappings = {
      fieldMappings: [
        { source: "a", target: "name", transform: "unknownTransform" },
        { source: "b", target: "age" },
      ],
    };
    const errors = validatePipelineConfig(fields, pipeline);
    expect(errors.some((e) => e.includes("unknownTransform"))).toBe(true);
  });

  it("returns empty for valid pipeline", () => {
    const pipeline: PipelineMappings = {
      fieldMappings: [
        { source: "a", target: "name" },
        { source: "b", target: "age" },
      ],
    };
    const errors = validatePipelineConfig(fields, pipeline);
    expect(errors).toHaveLength(0);
  });
});

describe("processImportedDataWithMappings", () => {
  const fields: FieldConfig[] = [
    { key: "name", label: "Name", type: "string", required: true },
    { key: "age", label: "Age", type: "number" },
  ];

  const data: ImportedData = {
    headers: ["Name Col", "Age Col"],
    rows: [
      { "Name Col": "Alice", "Age Col": "30" },
      { "Name Col": "Bob", "Age Col": "not-a-number" },
      { "Name Col": "", "Age Col": "25" },
    ],
  };

  const pipeline: PipelineMappings = {
    fieldMappings: [
      { source: "Name Col", target: "name" },
      { source: "Age Col", target: "age" },
    ],
  };

  it("processes rows with correct mapping", () => {
    const result = processImportedDataWithMappings(data, fields, pipeline);
    expect(result).toHaveLength(3);
    expect(result[0].data.name).toBe("Alice");
    expect(result[0].data.age).toBe(30);
    expect(result[0].isValid).toBe(true);
  });

  it("flags invalid number values", () => {
    const result = processImportedDataWithMappings(data, fields, pipeline);
    expect(result[1].isValid).toBe(false);
    expect(result[1].errors.some((e) => e.field === "age")).toBe(true);
  });

  it("flags missing required fields", () => {
    const result = processImportedDataWithMappings(data, fields, pipeline);
    expect(result[2].errors.some((e) => e.field === "name")).toBe(true);
  });

  it("detects uniqueness violations without duplicates", () => {
    const uniqueFields: FieldConfig[] = [
      { key: "email", label: "Email", type: "email", unique: true },
    ];
    const dupData: ImportedData = {
      headers: ["email"],
      rows: [
        { email: "a@b.com" },
        { email: "c@d.com" },
        { email: "a@b.com" },
      ],
    };
    const pl: PipelineMappings = {
      fieldMappings: [{ source: "email", target: "email" }],
    };
    const result = processImportedDataWithMappings(dupData, uniqueFields, pl);
    const row0Errors = result[0].errors.filter((e) => e.message.includes("unique"));
    const row2Errors = result[2].errors.filter((e) => e.message.includes("unique"));
    expect(row0Errors).toHaveLength(1);
    expect(row2Errors).toHaveLength(1);
  });
});

describe("getUnmappedRequiredFields", () => {
  const fields: FieldConfig[] = [
    { key: "external_id", label: "External ID", type: "string", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "manager", label: "Manager", type: "email", required: true },
    { key: "phone", label: "Phone", type: "phone" },
  ];

  it("returns required fields with no source column, in schema order", () => {
    const out = getUnmappedRequiredFields(fields, [{ source: "E-mail", target: "email" }]);
    expect(out.map((f) => f.key)).toEqual(["external_id", "manager"]);
  });

  it("ignores optional fields and tolerates an undefined mapping list", () => {
    expect(getUnmappedRequiredFields(fields, undefined).map((f) => f.key)).toEqual([
      "external_id",
      "email",
      "manager",
    ]);
    const all = [
      { source: "a", target: "external_id" },
      { source: "b", target: "email" },
      { source: "c", target: "manager" },
    ];
    expect(getUnmappedRequiredFields(fields, all)).toEqual([]);
  });
});

describe("unmapped required fields during processing (allowUnmappedRequired)", () => {
  const fields: FieldConfig[] = [
    { key: "external_id", label: "External ID", type: "string", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "manager", label: "Manager", type: "email", required: true },
    { key: "phone", label: "Phone", type: "phone" },
  ];
  const data: ImportedData = {
    headers: ["E-mail", "Mobile"],
    rows: [
      { "E-mail": "ana@x.com", Mobile: "5551234567" },
      { "E-mail": "", Mobile: "5559876543" },
    ],
  };
  const pipeline: PipelineMappings = {
    fieldMappings: [
      { source: "E-mail", target: "email" },
      { source: "Mobile", target: "phone" },
    ],
  };

  it("gives every row one clear error per unmapped required field", () => {
    const rows = processImportedDataWithMappings(data, fields, pipeline);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const ext = row.errors.filter((e) => e.field === "external_id");
      const mgr = row.errors.filter((e) => e.field === "manager");
      expect(ext).toHaveLength(1);
      expect(mgr).toHaveLength(1);
      expect(ext[0].message).toBe("External ID is required and your file has no column for it");
      expect(mgr[0].message).toBe("Manager is required and your file has no column for it");
      expect(ext[0].severity).toBe("error");
      expect(row.isValid).toBe(false);
    }
  });

  it("does not double-report a mapped required field that is empty", () => {
    const rows = processImportedDataWithMappings(data, fields, pipeline);
    const emailErrors0 = rows[0].errors.filter((e) => e.field === "email");
    const emailErrors1 = rows[1].errors.filter((e) => e.field === "email");
    expect(emailErrors0).toHaveLength(0);
    expect(emailErrors1).toHaveLength(1);
    expect(emailErrors1[0].message).toBe("Email is required");
    expect(rows[1].errors).toHaveLength(3);
  });

  it("uses the same message on the mapping-state (no pipeline) path", () => {
    const rows = processRowBatch(data.rows, 0, fields, undefined, { "E-mail": "email", Mobile: "phone" });
    expect(rows[0].errors.map((e) => e.message)).toEqual([
      unmappedRequiredMessage(fields[0]),
      unmappedRequiredMessage(fields[2]),
    ]);
  });

  it("counts as invalid rows so summaries reflect them", () => {
    const rows = processImportedDataWithMappings(data, fields, pipeline);
    expect(rows.filter((r) => !r.isValid)).toHaveLength(2);
    expect(rows.flatMap((r) => r.errors).filter((e) => e.field === "manager")).toHaveLength(2);
  });
});

describe("collectHeaderSamples", () => {
  it("returns the first distinct non-empty trimmed values, capped and truncated", () => {
    const rows = [
      { A: " x ", B: "" },
      { A: "x", B: null },
      { A: "y", B: "z".repeat(80) },
      { A: "w", B: "q" },
      { A: "v", B: "r" },
    ];
    const s = collectHeaderSamples(["A", "B", "C"], rows);
    expect(s.A).toEqual(["x", "y", "w"]);
    expect(s.B[0]).toHaveLength(60);
    expect(s.B).toEqual(["z".repeat(60), "q", "r"]);
    expect(s.C).toEqual([]);
  });
});

describe("applyAiColumnMappings", () => {
  const keys = new Set(["hireDate", "dateOfBirth", "managerEmail", "email", "firstName"]);

  it("replaces a wrong local match with a confident AI target", () => {
    const out = applyAiColumnMappings(
      ["DOB", "Start Date"],
      { DOB: "hireDate", "Start Date": "managerEmail" },
      [
        { source: "DOB", target: "dateOfBirth", confidence: 0.95 },
        { source: "Start Date", target: "hireDate", confidence: 0.9 },
      ],
      keys
    );
    expect(out).toEqual({ DOB: "dateOfBirth", "Start Date": "hireDate" });
  });

  it("removes a local match when the AI confidently says null", () => {
    const out = applyAiColumnMappings(["Notes"], { Notes: "firstName" }, [{ source: "Notes", target: null, confidence: 0.8 }], keys);
    expect(out).toEqual({ Notes: null });
  });

  it("keeps the local match for low-confidence or missing AI entries", () => {
    const out = applyAiColumnMappings(
      ["Given Name", "Mail"],
      { "Given Name": "firstName", Mail: "email" },
      [{ source: "Given Name", target: null, confidence: 0.2 }],
      keys
    );
    expect(out).toEqual({ "Given Name": "firstName", Mail: "email" });
  });

  it("never assigns a target twice and drops a local match whose target the AI took", () => {
    const out = applyAiColumnMappings(
      ["Work E-mail", "Mgr E-mail"],
      { "Mgr E-mail": "email" },
      [{ source: "Work E-mail", target: "email", confidence: 0.9 }, { source: "Mgr E-mail", target: "email", confidence: 0.9 }],
      keys
    );
    expect(out).toEqual({ "Work E-mail": "email", "Mgr E-mail": null });
  });

  it("ignores targets that are not schema fields", () => {
    const out = applyAiColumnMappings(["X"], { X: "email" }, [{ source: "X", target: "nope", confidence: 0.99 }], keys);
    expect(out).toEqual({ X: "email" });
  });
});
