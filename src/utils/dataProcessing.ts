import Papa from "papaparse";
import * as XLSX from "xlsx";
import { detect as detectEncoding } from "jschardet";
import {
  ImportedData,
  FieldConfig,
  ValidationRule,
  ValidationError,
  DataRow,
  FieldMapping,
  PipelineMappings,
  TransformRegistry,
} from "../types";

// File parsing utilities
export const parseCSV = (file: File): Promise<ImportedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const sampleBytes = new Uint8Array(
          buffer.slice(0, Math.min(buffer.byteLength, 512 * 1024))
        );
        // jschardet expects a string; provide a best-effort 1:1 byte mapping via windows-1252
        // for detection purposes only
        let sampleString = "";
        try {
          sampleString = new TextDecoder("windows-1252").decode(sampleBytes);
        } catch {
          // Fallback to latin-1 style mapping using code points
          sampleString = Array.from(sampleBytes)
            .map((c) => String.fromCharCode(c))
            .join("");
        }
        const detection = detectEncoding(sampleString);
        let encoding = (detection.encoding || "utf-8").toLowerCase();
        // If detection confidence is low, default to utf-8
        if (!detection.encoding || (detection.confidence || 0) < 0.2) {
          encoding = "utf-8";
        }

        let text: string;
        try {
          text = new TextDecoder(encoding as string).decode(new Uint8Array(buffer));
        } catch (_err) {
          // Fallback to utf-8 if the encoding label isn't supported in this browser
          text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
        }

        const baseOptions = {
          header: true,
          skipEmptyLines: true,
          transform: (value: string) => (typeof value === "string" ? value.trim() : value),
          transformHeader: (header: string) => (typeof header === "string" ? header.trim() : header),
        } as const;

        const tryParse = (delimiter?: string) =>
          Papa.parse(text, delimiter ? { ...baseOptions, delimiter } : baseOptions);

        const hasSeriousErrors = (res: Papa.ParseResult<any>) =>
          Array.isArray(res.errors) && res.errors.some((e) => e.type !== "FieldMismatch" && e.type !== "Delimiter");

        const onlyDelimiterIssue = (res: Papa.ParseResult<any>) =>
          Array.isArray(res.errors) && res.errors.length > 0 && res.errors.every((e) => e.type === "Delimiter");

        let results = tryParse();

        // If auto-detection failed or we got suspiciously few fields, try common delimiters
        if (onlyDelimiterIssue(results) || ((results.meta.fields || []).length <= 1)) {
          const candidates = [";", "\t", "|", ","];
          let best = results;
          let bestFields = (best.meta.fields || []).length;
          for (const d of candidates) {
            const r = tryParse(d);
            const fieldsCount = (r.meta.fields || []).length;
            if (!hasSeriousErrors(r) && fieldsCount > bestFields) {
              best = r;
              bestFields = fieldsCount;
            }
            if (!hasSeriousErrors(r) && fieldsCount >= 2) {
              // Early accept once we find a reasonable delimiter
              best = r;
              break;
            }
          }
          results = best;
        }

        if (hasSeriousErrors(results)) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          return;
        }

        resolve({
          headers: results.meta.fields || [],
          rows: results.data as Record<string, any>[],
          fileName: file.name,
          fileType: "csv",
        });
      } catch (error: any) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

// Backend-compatible defaults and helpers (CSV/XLSX lightweight parity)
export const defaultTransforms: TransformRegistry = {
  toLowerCase: (v: any) => (v == null ? v : String(v).toLowerCase()),
  toUpperCase: (v: any) => (v == null ? v : String(v).toUpperCase()),
  capitalize: (v: any) => {
    if (v == null) return v;
    const s = String(v).toLowerCase();
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  },
  trim: (v: any) => (v == null ? v : String(v).trim()),
  toNumber: (v: any) => (v == null || v === "" ? null : Number(v)),
  formatPhoneNumber: (v: any) => (v == null ? v : String(v).replace(/[^0-9]/g, "")),
  formatEmail: (v: any) => (v == null ? v : String(v).trim().toLowerCase()),
};

export const applyNamedTransform = (
  value: any,
  transformName?: string,
  registry?: TransformRegistry
): any => {
  if (!transformName) return value;
  const fn = registry?.[transformName];
  try {
    return fn ? fn(value) : value;
  } catch {
    return value;
  }
};

export const mappingStateToFieldMappings = (
  mapping: Record<string, string | null>
): FieldMapping[] =>
  Object.entries(mapping)
    .filter(([, target]) => !!target)
    .map(([source, target]) => ({ source, target: target as string }));

export const fieldMappingsToMappingState = (
  fieldMappings: FieldMapping[]
): Record<string, string | null> => {
  const out: Record<string, string | null> = {};
  for (const m of fieldMappings) out[m.source] = m.target || null;
  return out;
};

export const validatePipelineConfig = (
  fields: FieldConfig[],
  pipeline: PipelineMappings,
  availableTransforms: string[] = Object.keys(defaultTransforms)
): string[] => {
  const errors: string[] = [];
  const required = new Set(fields.filter(f => f.required).map(f => f.key));
  const mappedTargets = new Set<string>();
  for (const m of pipeline.fieldMappings || []) {
    if (m.target) mappedTargets.add(m.target);
    if (m.transform && !availableTransforms.includes(m.transform)) {
      errors.push(`Transform '${m.transform}' referenced by mapping ${m.source} -> ${m.target} is not available`);
    }
  }
  for (const key of required) {
    if (!mappedTargets.has(key)) errors.push(`Missing mapping for required field '${key}'`);
  }
  return errors;
};

export const processImportedDataWithMappings = (
  importedData: ImportedData,
  fields: FieldConfig[],
  pipeline: PipelineMappings,
  registry: TransformRegistry = defaultTransforms
): DataRow[] => {
  const rows: DataRow[] = importedData.rows.map((row, index) => {
    const processed: Record<string, any> = {};
    const errors: ValidationError[] = [];

    for (const m of pipeline.fieldMappings || []) {
      const { source, target, transform } = m;
      if (!(source in row)) continue;
      const field = fields.find(f => f.key === target);
      if (!field) continue;
      let v = row[source];
      v = applyNamedTransform(v, transform, registry);
      const coerced = transformValue(v, field.type);
      processed[target] = coerced;
      errors.push(...validateField(coerced, field, index));
    }

    for (const f of fields) {
      if (f.required && !(f.key in processed)) {
        errors.push({ row: index, field: f.key, message: `${f.label} is required but not mapped`, severity: "error" });
      }
    }

    return { id: `row-${index}`, data: processed, errors, isValid: errors.filter(e => e.severity === "error").length === 0 };
  });

  // Uniqueness across all rows
  const uniqueFields = fields.filter(f => f.unique);
  for (const f of uniqueFields) {
    const seen = new Map<string, number>();
    rows.forEach((r, idx) => {
      const val = r.data[f.key];
      if (val === undefined || val === null || val === "") return;
      const key = String(val);
      if (seen.has(key)) {
        const first = seen.get(key)!;
        const push = (rowIdx: number) => {
          rows[rowIdx].errors.push({ row: rowIdx, field: f.key, message: `${f.label} must be unique. Duplicate value '${key}' found`, severity: "error" });
          rows[rowIdx].isValid = false;
        };
        push(first);
        push(idx);
      } else {
        seen.set(key, idx);
      }
    });
  }

  return rows;
};


export const parseExcel = (file: File): Promise<ImportedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          reject(new Error("Empty Excel file"));
          return;
        }

        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1).map((row: any[]) => {
          const rowObj: Record<string, any> = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] || "";
          });
          return rowObj;
        });

        resolve({
          headers,
          rows,
          fileName: file.name,
          fileType: "excel",
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

// Validation utilities
export const validateField = (
  value: any,
  field: FieldConfig,
  rowIndex: number
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Required validation
  if (
    field.required &&
    (value === null || value === undefined || value === "")
  ) {
    errors.push({
      row: rowIndex,
      field: field.key,
      message: `${field.label} is required`,
      severity: "error",
    });
    return errors; // Don't continue if required field is empty
  }

  // Type validation
  if (value !== null && value !== undefined && value !== "") {
    switch (field.type) {
      case "number":
        if (isNaN(Number(value))) {
          errors.push({
            row: rowIndex,
            field: field.key,
            message: `${field.label} must be a valid number`,
            severity: "error",
          });
        }
        break;
      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          errors.push({
            row: rowIndex,
            field: field.key,
            message: `${field.label} must be a valid email address`,
            severity: "error",
          });
        }
        break;
      case "date":
        if (isNaN(Date.parse(String(value)))) {
          errors.push({
            row: rowIndex,
            field: field.key,
            message: `${field.label} must be a valid date`,
            severity: "error",
          });
        }
        break;
      case "boolean":
        const booleanValues = ["true", "false", "1", "0", "yes", "no"];
        if (!booleanValues.includes(String(value).toLowerCase())) {
          errors.push({
            row: rowIndex,
            field: field.key,
            message: `${field.label} must be a valid boolean value`,
            severity: "error",
          });
        }
        break;
    }
  }

  // Custom validations
  if (field.validations) {
    field.validations.forEach((validation) => {
      const validationError = validateRule(value, validation, field, rowIndex);
      if (validationError) {
        errors.push(validationError);
      }
    });
  }

  return errors;
};

const validateRule = (
  value: any,
  rule: ValidationRule,
  field: FieldConfig,
  rowIndex: number
): ValidationError | null => {
  switch (rule.type) {
    case "regex":
      if (value && !new RegExp(rule.value).test(String(value))) {
        return {
          row: rowIndex,
          field: field.key,
          message: rule.message,
          severity: "error",
        };
      }
      break;
    case "min":
      if (field.type === "number" && Number(value) < rule.value) {
        return {
          row: rowIndex,
          field: field.key,
          message: rule.message,
          severity: "error",
        };
      }
      if (field.type === "string" && String(value).length < rule.value) {
        return {
          row: rowIndex,
          field: field.key,
          message: rule.message,
          severity: "error",
        };
      }
      break;
    case "max":
      if (field.type === "number" && Number(value) > rule.value) {
        return {
          row: rowIndex,
          field: field.key,
          message: rule.message,
          severity: "error",
        };
      }
      if (field.type === "string" && String(value).length > rule.value) {
        return {
          row: rowIndex,
          field: field.key,
          message: rule.message,
          severity: "error",
        };
      }
      break;
    case "custom":
      // Custom validation would be handled by the consuming application
      break;
  }
  return null;
};

// Data transformation utilities
export const transformValue = (value: any, fieldType: string): any => {
  if (value === null || value === undefined || value === "") {
    return value;
  }

  switch (fieldType) {
    case "string":
      return String(value).trim();
    case "number":
      return Number(value);
    case "boolean":
      const str = String(value).toLowerCase();
      return str === "true" || str === "1" || str === "yes";
    case "date":
      return new Date(value).toISOString();
    default:
      return value;
  }
};

// Auto-mapping utilities
export const generateAutoMapping = (
  importedHeaders: string[],
  fields: FieldConfig[],
  confidenceThreshold: number = 0.7
): Record<string, string | null> => {
  const mapping: Record<string, string | null> = {};

  importedHeaders.forEach((header) => {
    let bestMatch: { field: string; confidence: number } | null = null;

    fields.forEach((field) => {
      const confidence =
        calculateSimilarity(header.toLowerCase(), field.label.toLowerCase()) ||
        calculateSimilarity(header.toLowerCase(), field.key.toLowerCase());

      if (
        confidence > confidenceThreshold &&
        (!bestMatch || confidence > bestMatch.confidence)
      ) {
        bestMatch = { field: field.key, confidence };
      }
    });

    mapping[header] = bestMatch ? bestMatch.field : null;
  });

  return mapping;
};

const calculateSimilarity = (str1: string, str2: string): number => {
  // Simple similarity calculation using Levenshtein distance
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  const distance = matrix[str2.length][str1.length];
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
};

// Process imported data with mapping and validation
export const processImportedData = (
  importedData: ImportedData,
  fields: FieldConfig[],
  mapping: Record<string, string | null>
): DataRow[] => {
  return importedData.rows.map((row, index) => {
    const processedRow: Record<string, any> = {};
    const errors: ValidationError[] = [];

    // Apply mapping and transformation
    Object.entries(mapping).forEach(([sourceColumn, targetField]) => {
      if (targetField && row[sourceColumn] !== undefined) {
        const field = fields.find((f) => f.key === targetField);
        if (field) {
          const transformedValue = transformValue(
            row[sourceColumn],
            field.type
          );
          processedRow[targetField] = transformedValue;

          // Validate the field
          const fieldErrors = validateField(transformedValue, field, index);
          errors.push(...fieldErrors);
        }
      }
    });

    // Check for missing required fields
    fields.forEach((field) => {
      if (field.required && !(field.key in processedRow)) {
        errors.push({
          row: index,
          field: field.key,
          message: `${field.label} is required but not mapped`,
          severity: "error",
        });
      }
    });

    return {
      id: `row-${index}`,
      data: processedRow,
      errors,
      isValid: errors.filter((e) => e.severity === "error").length === 0,
    };
  });
};
