import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  ImportedData,
  FieldConfig,
  ValidationRule,
  ValidationError,
  DataRow,
} from "@/types";

// File parsing utilities
export const parseCSV = (file: File): Promise<ImportedData> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          return;
        }

        resolve({
          headers: results.meta.fields || [],
          rows: results.data as Record<string, any>[],
          fileName: file.name,
          fileType: "csv",
        });
      },
      error: (error) => reject(error),
    });
  });
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
