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
  transformValue,
  applyNamedTransform,
} from "../utils/dataProcessing";

// Module-level helpers for background processing
let reprocessTimer: any = null;
const PROCESS_DEBOUNCE_MS = 400;
let processingRunId = 0;

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
  processDataChunked: () => Promise<void>;
  scheduleChunkedProcessing: () => void;
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
              mappingState: fieldMappingsToMappingState(
                effective.fieldMappings
              ),
            });
            pipelineMappings = effective;
          }

          set({ pipelineMappings });

          // If dataset is small, process immediately; otherwise, start background processing
          const threshold = (get() as any).LARGE_DATA_THRESHOLD || 10000;
          if ((data.rows?.length || 0) <= threshold) {
            const processedData = processImportedDataWithMappings(
              data,
              currentSheetConfig.fields,
              pipelineMappings,
              state.transformRegistry || defaultTransforms
            );
            set({ processedData });
            const validationErrors = processedData.flatMap((row) => row.errors);
            set({ validationErrors });
          } else {
            set({ processedData: [], validationErrors: [] });
            // Kick off background chunked processing automatically
            get().processDataChunked();
          }
        }
      },

      // Chunked processing to avoid long main-thread stalls for very large datasets
      processDataChunked: async () => {
        const state = get();
        if (!state.importedData) return;
        const currentSheetConfig = state.config.sheets?.find(
          (sheet) => sheet.slug === state.currentSheet
        );
        if (!currentSheetConfig) return;

        const rows = state.importedData.rows || [];
        const fields = currentSheetConfig.fields;
        const pipeline = state.pipelineMappings;
        const registry = state.transformRegistry || defaultTransforms;
        // cancel previous runs and start a new one
        const runId = ++processingRunId;
        set({ isLoading: true });
        const BATCH = 2000;
        const processed: DataRow[] = [];

        // Map + validate in batches (without uniqueness)
        for (let start = 0; start < rows.length; start += BATCH) {
          if (runId !== processingRunId) {
            // aborted
            return;
          }
          const end = Math.min(rows.length, start + BATCH);
          for (let index = start; index < end; index++) {
            if (runId !== processingRunId) return;
            const row = rows[index];
            const out: Record<string, any> = {};
            const errors: ValidationError[] = [];
            if (pipeline) {
              for (const m of pipeline.fieldMappings || []) {
                const { source, target, transform } = m;
                if (!(source in row) || !target) continue;
                const field = fields.find((f) => f.key === target);
                if (!field) continue;
                let v = row[source];
                v = applyNamedTransform(v, transform, registry);
                const coerced = transformValue(v, field.type);
                out[target] = coerced;
                errors.push(...validateField(coerced, field, index));
              }
            } else {
              for (const [sourceColumn, targetField] of Object.entries(
                state.mappingState
              )) {
                if (!targetField || row[sourceColumn] === undefined) continue;
                const field = fields.find((f) => f.key === targetField);
                if (!field) continue;
                const coerced = transformValue(row[sourceColumn], field.type);
                out[targetField] = coerced;
                errors.push(...validateField(coerced, field, index));
              }
            }

            for (const f of fields) {
              if (f.required && !(f.key in out)) {
                errors.push({
                  row: index,
                  field: f.key,
                  message: `${f.label} is required but not mapped`,
                  severity: "error",
                });
              }
            }

            processed.push({
              id: `row-${index}`,
              data: out,
              errors,
              isValid:
                errors.filter((e) => e.severity === "error").length === 0,
            });
          }
          // Emit partial progress and yield to the event loop
          if (runId !== processingRunId) return;
          set({ processedData: [...processed] });
          await new Promise((r) => setTimeout(r, 0));
        }

        // Uniqueness validation pass
        if (runId !== processingRunId) return;
        const uniqueFields = fields.filter((f) => f.unique);
        for (const f of uniqueFields) {
          const seen = new Map<string, number>();
          processed.forEach((r, idx) => {
            const val = r.data[f.key];
            if (val === undefined || val === null || val === "") return;
            const key = String(val);
            if (seen.has(key)) {
              const first = seen.get(key)!;
              const push = (rowIdx: number) => {
                processed[rowIdx].errors.push({
                  row: rowIdx,
                  field: f.key,
                  message: `${f.label} must be unique. Duplicate value '${key}' found`,
                  severity: "error",
                });
                processed[rowIdx].isValid = false;
              };
              push(first);
              push(idx);
            } else {
              seen.set(key, idx);
            }
          });
        }

        if (runId !== processingRunId) return;
        set({ processedData: processed });
        set({
          validationErrors: processed.flatMap((r) => r.errors),
          isLoading: false,
        });
      },

      // Debounced trigger for chunked processing
      scheduleChunkedProcessing: () => {
        const state = get();
        if (!state.importedData) return;
        if (reprocessTimer) clearTimeout(reprocessTimer);
        set({ isLoading: true });
        reprocessTimer = setTimeout(() => {
          get().processDataChunked();
        }, PROCESS_DEBOUNCE_MS) as any;
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
        const threshold = (get() as any).LARGE_DATA_THRESHOLD || 10000;
        if ((get().importedData?.rows.length || 0) <= threshold) {
          get().processData();
        } else {
          get().scheduleChunkedProcessing();
        }
      },

      setFieldMappings: (fieldMappings) => {
        const state = get();
        // Enforce uniqueness by target: last mapping wins
        const targetToSource = new Map<string, string>();
        for (const m of fieldMappings || []) {
          if (!m.target) continue;
          targetToSource.set(m.target, m.source);
        }
        const compacted: FieldMapping[] = Array.from(
          targetToSource.entries()
        ).map(([target, source]) => ({ source, target }));
        set({
          pipelineMappings: {
            ...(state.pipelineMappings || {}),
            fieldMappings: compacted,
          },
          mappingState: fieldMappingsToMappingState(compacted),
        });
        const threshold = (get() as any).LARGE_DATA_THRESHOLD || 10000;
        if ((get().importedData?.rows.length || 0) <= threshold) {
          get().processData();
        } else {
          get().scheduleChunkedProcessing();
        }
      },

      setTransformRegistry: (registry) => {
        set({ transformRegistry: registry });
        const threshold = (get() as any).LARGE_DATA_THRESHOLD || 10000;
        if ((get().importedData?.rows.length || 0) <= threshold) {
          get().processData();
        } else {
          get().scheduleChunkedProcessing();
        }
      },

      updateMapping: (sourceColumn, targetField) => {
        const state = get();
        const newMapping: MappingState = { ...state.mappingState };
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
        const threshold = (get() as any).LARGE_DATA_THRESHOLD || 10000;
        if ((get().importedData?.rows.length || 0) <= threshold) {
          get().processData();
        } else {
          get().scheduleChunkedProcessing();
        }
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
          const threshold = (get() as any).LARGE_DATA_THRESHOLD || 10000;
          if ((get().importedData?.rows.length || 0) <= threshold) {
            get().processData();
          } else {
            set({ processedData: [], validationErrors: [] });
          }
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
