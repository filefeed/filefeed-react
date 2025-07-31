import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  WorkbookState,
  CreateWorkbookConfig,
  ImportedData,
  MappingState,
  DataRow,
  ValidationError,
} from "@/types";
import {
  processImportedData,
  generateAutoMapping,
} from "@/utils/dataProcessing";

interface WorkbookActions {
  // Configuration
  setConfig: (config: CreateWorkbookConfig) => void;
  setCurrentSheet: (sheetSlug: string) => void;

  // Data import
  setImportedData: (data: ImportedData) => void;
  clearImportedData: () => void;

  // Mapping
  setMapping: (mapping: MappingState) => void;
  updateMapping: (sourceColumn: string, targetField: string | null) => void;
  generateAutoMapping: () => void;

  // Data processing
  processData: () => void;
  updateRowData: (rowId: string, fieldKey: string, value: any) => void;
  deleteRow: (rowId: string) => void;
  addRow: () => void;

  // Loading states
  setLoading: (loading: boolean) => void;

  // Reset
  reset: () => void;
}

type WorkbookStore = WorkbookState & WorkbookActions;

const initialState: WorkbookState = {
  config: {
    name: "",
    sheets: [],
    actions: [],
  },
  currentSheet: "",
  importedData: null,
  mappingState: {},
  processedData: [],
  validationErrors: [],
  isLoading: false,
};

export const useWorkbookStore = create<WorkbookStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setConfig: (config) => {
        set({ config });
        // Set first sheet as current if available
        if (config.sheets && config.sheets.length > 0) {
          set({ currentSheet: config.sheets[0].slug });
        }
      },

      setCurrentSheet: (sheetSlug) => {
        set({ currentSheet: sheetSlug });
        // Clear data when switching sheets
        set({
          importedData: null,
          mappingState: {},
          processedData: [],
          validationErrors: [],
        });
      },

      setImportedData: (data) => {
        set({ importedData: data });
        // Auto-generate mapping when data is imported
        const state = get();
        const currentSheetConfig = state.config.sheets?.find(
          (sheet) => sheet.slug === state.currentSheet
        );

        if (currentSheetConfig) {
          const autoMapping = generateAutoMapping(
            data.headers,
            currentSheetConfig.fields,
            currentSheetConfig.mappingConfidenceThreshold
          );
          set({ mappingState: autoMapping });

          // Process data immediately with auto-mapping
          const processedData = processImportedData(
            data,
            currentSheetConfig.fields,
            autoMapping
          );
          set({ processedData });

          // Extract validation errors
          const validationErrors = processedData.flatMap((row) => row.errors);
          set({ validationErrors });
        }
      },

      clearImportedData: () => {
        set({
          importedData: null,
          mappingState: {},
          processedData: [],
          validationErrors: [],
        });
      },

      setMapping: (mapping) => {
        set({ mappingState: mapping });
        // Reprocess data with new mapping
        get().processData();
      },

      updateMapping: (sourceColumn, targetField) => {
        const state = get();
        const newMapping = {
          ...state.mappingState,
          [sourceColumn]: targetField,
        };
        set({ mappingState: newMapping });
        // Reprocess data with updated mapping
        get().processData();
      },

      generateAutoMapping: () => {
        const state = get();
        if (!state.importedData) return;

        const currentSheetConfig = state.config.sheets?.find(
          (sheet) => sheet.slug === state.currentSheet
        );

        if (currentSheetConfig) {
          const autoMapping = generateAutoMapping(
            state.importedData.headers,
            currentSheetConfig.fields,
            currentSheetConfig.mappingConfidenceThreshold
          );
          set({ mappingState: autoMapping });
          get().processData();
        }
      },

      processData: () => {
        const state = get();
        if (!state.importedData) return;

        const currentSheetConfig = state.config.sheets?.find(
          (sheet) => sheet.slug === state.currentSheet
        );

        if (currentSheetConfig) {
          const processedData = processImportedData(
            state.importedData,
            currentSheetConfig.fields,
            state.mappingState
          );
          set({ processedData });

          // Extract validation errors
          const validationErrors = processedData.flatMap((row) => row.errors);
          set({ validationErrors });
        }
      },

      updateRowData: (rowId, fieldKey, value) => {
        const state = get();
        const currentSheetConfig = state.config.sheets?.find(
          (sheet) => sheet.slug === state.currentSheet
        );

        if (!currentSheetConfig) return;

        const updatedData = state.processedData.map((row) => {
          if (row.id === rowId) {
            const newData = { ...row.data, [fieldKey]: value };

            // Re-validate the updated row
            const field = currentSheetConfig.fields.find(
              (f) => f.key === fieldKey
            );
            const errors = row.errors.filter((e) => e.field !== fieldKey);

            if (field) {
              const rowIndex = state.processedData.findIndex(
                (r) => r.id === rowId
              );
              const { validateField } = require("@/utils/dataProcessing");
              const fieldErrors = validateField(value, field, rowIndex);
              errors.push(...fieldErrors);
            }

            return {
              ...row,
              data: newData,
              errors,
              isValid:
                errors.filter((e) => e.severity === "error").length === 0,
            };
          }
          return row;
        });

        set({ processedData: updatedData });

        // Update validation errors
        const validationErrors = updatedData.flatMap((row) => row.errors);
        set({ validationErrors });
      },

      deleteRow: (rowId) => {
        const state = get();
        const updatedData = state.processedData.filter(
          (row) => row.id !== rowId
        );
        set({ processedData: updatedData });

        // Update validation errors
        const validationErrors = updatedData.flatMap((row) => row.errors);
        set({ validationErrors });
      },

      addRow: () => {
        const state = get();
        const newRowId = `row-${Date.now()}`;
        const newRow: DataRow = {
          id: newRowId,
          data: {},
          errors: [],
          isValid: false,
        };

        set({ processedData: [...state.processedData, newRow] });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "cellvio-workbook-store",
    }
  )
);
