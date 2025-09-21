import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  WorkbookState,
  CreateWorkbookConfig,
  ImportedData,
  MappingState,
  DataRow,
  ValidationError,
  FieldMapping,
  TransformRegistry,
} from "../types";
import {
  processImportedData,
  generateAutoMapping,
  processImportedDataWithMappings,
  mappingStateToFieldMappings,
  fieldMappingsToMappingState,
  defaultTransforms,
  validateField,
} from "../utils/dataProcessing";

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
  setFieldMappings: (fieldMappings: FieldMapping[]) => void;
  setTransformRegistry: (registry: TransformRegistry) => void;

  // Data processing
  processData: () => void;
  setProcessedRows: (rows: DataRow[]) => void;
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
  pipelineMappings: undefined,
  transformRegistry: defaultTransforms,
};

export const useWorkbookStore = create<WorkbookStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setConfig: (config) => {
        set({ config });
        // Set first sheet as current if available
        if (config.sheets && config.sheets.length > 0) {
          const first = config.sheets[0];
          set({
            currentSheet: first.slug,
            pipelineMappings: first.pipelineMappings,
          });
        }
      },

      setProcessedRows: (rows) => {
        set({ processedData: rows });
        const validationErrors = rows.flatMap((r) => r.errors || []);
        set({ validationErrors });
      },

      setCurrentSheet: (sheetSlug) => {
        set({ currentSheet: sheetSlug });
        // Clear data when switching sheets
        set({
          importedData: null,
          mappingState: {},
          processedData: [],
          validationErrors: [],
          pipelineMappings: get().config.sheets?.find(
            (s) => s.slug === sheetSlug
          )?.pipelineMappings,
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
          // Prefer backend-compatible pipeline mappings if provided on sheet
          let pipelineMappings = currentSheetConfig.pipelineMappings;
          if (!pipelineMappings) {
            const autoMapping = generateAutoMapping(
              data.headers,
              currentSheetConfig.fields,
              currentSheetConfig.mappingConfidenceThreshold
            );
            // keep legacy mapping state
            set({ mappingState: autoMapping });
            pipelineMappings = {
              fieldMappings: mappingStateToFieldMappings(autoMapping),
            };
          } else {
            // Keep mappingState in sync for UI components relying on it
            // IMPORTANT: Restrict seed mappings to headers that actually exist in the uploaded file
            // and dedupe by target to avoid pre-consuming all targets.
            const filtered = (pipelineMappings.fieldMappings || []).filter(
              (m) => data.headers.includes(m.source)
            );
            const seenTargets = new Set<string>();
            const deduped = filtered.filter((m) => {
              if (!m.target) return false;
              if (seenTargets.has(m.target)) return false;
              seenTargets.add(m.target);
              return true;
            });
            const effective = { ...pipelineMappings, fieldMappings: deduped };
            set({
              mappingState: fieldMappingsToMappingState(effective.fieldMappings),
            });
            pipelineMappings = effective;
          }

          set({ pipelineMappings });

          // Process data with backend-compatible structure
          const processedData = processImportedDataWithMappings(
            data,
            currentSheetConfig.fields,
            pipelineMappings,
            state.transformRegistry || defaultTransforms
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
        set({
          mappingState: mapping,
          pipelineMappings: {
            fieldMappings: mappingStateToFieldMappings(mapping),
          },
        });
        // Reprocess data with new mapping
        get().processData();
      },

      setFieldMappings: (fieldMappings) => {
        const state = get();
        // Enforce uniqueness by target: last mapping wins
        const targetToSource = new Map<string, string>();
        for (const m of fieldMappings || []) {
          if (!m.target) continue;
          targetToSource.set(m.target, m.source);
        }
        const compacted: FieldMapping[] = Array.from(targetToSource.entries()).map(
          ([target, source]) => ({ source, target })
        );
        set({
          pipelineMappings: {
            ...(state.pipelineMappings || {}),
            fieldMappings: compacted,
          },
          // keep legacy mappingState synchronized for components relying on it
          mappingState: fieldMappingsToMappingState(compacted),
        });
        get().processData();
      },

      setTransformRegistry: (registry) => {
        set({ transformRegistry: registry });
        // Re-run processing because transforms may change output
        get().processData();
      },

      updateMapping: (sourceColumn, targetField) => {
        const state = get();
        // Start from existing mapping
        const newMapping: MappingState = { ...state.mappingState };
        // If assigning to a target, clear it from any other source first to enforce uniqueness
        if (targetField) {
          for (const [src, tgt] of Object.entries(newMapping)) {
            if (src !== sourceColumn && tgt === targetField) {
              newMapping[src] = null;
            }
          }
        }
        newMapping[sourceColumn] = targetField;
        set({
          mappingState: newMapping,
          pipelineMappings: {
            fieldMappings: mappingStateToFieldMappings(newMapping),
          },
        });
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
          set({
            mappingState: autoMapping,
            pipelineMappings: {
              fieldMappings: mappingStateToFieldMappings(autoMapping),
            },
          });
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
          const processedData = state.pipelineMappings
            ? processImportedDataWithMappings(
                state.importedData,
                currentSheetConfig.fields,
                state.pipelineMappings,
                state.transformRegistry || defaultTransforms
              )
            : processImportedData(
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
      name: "filefeed-workbook-store",
    }
  )
);
