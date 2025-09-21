import { useEffect, useMemo, useState } from "react";
import type { FieldConfig } from "../types";

export type ManualEntryFilter = "all" | "valid" | "invalid";

interface UseManualEntryReturn {
  manualEntryData: Record<string, Record<string, any>>;
  manualEntryErrors: Record<string, Record<string, string>>;
  selectedFilter: ManualEntryFilter;
  setSelectedFilter: (f: ManualEntryFilter) => void;
  isCalculatingValidation: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  isRowVisible: (rowIndex: number) => boolean;
  handleManualEntryChange: (
    rowIndex: number,
    fieldKey: string,
    value: string
  ) => void;
  reset: () => void;
}

export function useManualEntry(fields?: FieldConfig[]): UseManualEntryReturn {
  const [manualEntryData, setManualEntryData] = useState<Record<string, Record<string, any>>>({});
  const [manualEntryErrors, setManualEntryErrors] = useState<Record<string, Record<string, string>>>({});
  const [selectedFilter, setSelectedFilter] = useState<ManualEntryFilter>("all");
  const [isCalculatingValidation, setIsCalculatingValidation] = useState(false);

  const validateField = (fieldKey: string, value: any): string | null => {
    if (!fields || fields.length === 0) return null;
    const field = fields.find((f) => f.key === fieldKey);
    if (!field) return null;

    if (field.required && (!value || value.toString().trim() === "")) {
      return `${field.label} is required`;
    }

    if (!value || value.toString().trim() === "") {
      return null;
    }

    switch (field.type) {
      case "number":
        if (isNaN(Number(value))) {
          return `${field.label} must be a valid number`;
        }
        break;
      case "email":
        // Lightweight email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.toString())) {
          return `${field.label} must be a valid email address`;
        }
        break;
      case "date":
        if (isNaN(Date.parse(value.toString()))) {
          return `${field.label} must be a valid date`;
        }
        break;
    }

    if (field.validations) {
      for (const rule of field.validations) {
        switch (rule.type) {
          case "regex":
            if (rule.value && !new RegExp(rule.value).test(value.toString())) {
              return rule.message;
            }
            break;
          case "min":
            if (field.type === "number" && Number(value) < rule.value) {
              return rule.message;
            }
            if (field.type === "string" && value.toString().length < rule.value) {
              return rule.message;
            }
            break;
          case "max":
            if (field.type === "number" && Number(value) > rule.value) {
              return rule.message;
            }
            if (field.type === "string" && value.toString().length > rule.value) {
              return rule.message;
            }
            break;
        }
      }
    }

    return null;
  };

  const handleManualEntryChange = (
    rowIndex: number,
    fieldKey: string,
    value: string
  ) => {
    const rowId = `manual-${rowIndex}`;

    // Update data
    setManualEntryData((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [fieldKey]: value,
      },
    }));

    // Validate field
    const error = validateField(fieldKey, value);
    setManualEntryErrors((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [fieldKey]: error || "",
      },
    }));
  };

  // Recalculate validation indicator with small debounce
  useEffect(() => {
    if (Object.keys(manualEntryData).length > 0) {
      setIsCalculatingValidation(true);
      const timer = setTimeout(() => setIsCalculatingValidation(false), 300);
      return () => clearTimeout(timer);
    }
  }, [manualEntryData, manualEntryErrors]);

  const { totalRows, validRows, invalidRows } = useMemo(() => {
    let total = 0;
    let valids = 0;
    let invalids = 0;

    Object.keys(manualEntryData).forEach((rowId) => {
      const rowData = manualEntryData[rowId];
      const rowErrors = manualEntryErrors[rowId] || {};

      const hasData = Object.values(rowData).some(
        (v) => v && v.toString().trim() !== ""
      );
      if (!hasData) return;

      total++;
      const hasErrors = Object.values(rowErrors).some((e) => e && e.trim() !== "");
      if (hasErrors) invalids++;
      else valids++;
    });

    return { totalRows: total, validRows: valids, invalidRows: invalids };
  }, [manualEntryData, manualEntryErrors]);

  const isRowVisible = (rowIndex: number): boolean => {
    if (selectedFilter === "all") return true;

    const rowId = `manual-${rowIndex}`;
    const rowData = manualEntryData[rowId];
    const rowErrors = manualEntryErrors[rowId] || {};

    const hasData =
      rowData && Object.values(rowData).some((v) => v && v.toString().trim() !== "");
    if (!hasData) return false;

    const hasErrors = Object.values(rowErrors).some((e) => e && e.trim() !== "");
    if (selectedFilter === "valid") return !hasErrors;
    if (selectedFilter === "invalid") return hasErrors;
    return true;
  };

  const reset = () => {
    setManualEntryData({});
    setManualEntryErrors({});
    setSelectedFilter("all");
    setIsCalculatingValidation(false);
  };

  return {
    manualEntryData,
    manualEntryErrors,
    selectedFilter,
    setSelectedFilter,
    isCalculatingValidation,
    totalRows,
    validRows,
    invalidRows,
    isRowVisible,
    handleManualEntryChange,
    reset,
  };
}
