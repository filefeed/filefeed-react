import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
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
  generateAutoMapping,
  processImportedDataWithMappings,
  mappingStateToFieldMappings,
  fieldMappingsToMappingState,
  defaultTransforms,
  validateFieldWithRegistry,
  transformValue,
  applyNamedTransform,
} from "../utils/dataProcessing";

let processingRunId = 0;

interface WorkbookActions {
  setConfig: (config: CreateWorkbookConfig) => void;
  setCurrentSheet: (sheetSlug: string) => void;

  setImportedData: (data: ImportedData) => void;
  clearImportedData: () => void;

  setMapping: (mapping: MappingState) => void;
  updateMapping: (sourceColumn: string, targetField: string | null) => void;
  generateAutoMapping: () => void;
  setFieldMappings: (fieldMappings: FieldMapping[]) => void;
  setTransformRegistry: (registry: TransformRegistry) => void;

  processData: () => void;
  processDataChunked: () => Promise<void>;
  processOnContinue: () => Promise<void>;
  cancelProcessing: () => void;
  setProcessedRows: (rows: DataRow[]) => void;
  updateRowData: (rowId: string, fieldKey: string, value: any) => void;
  deleteRow: (rowId: string) => void;
  deleteInvalidRows: () => void;
  addRow: () => void;

  setLoading: (loading: boolean) => void;

  reset: () => void;
}

export type WorkbookStore = WorkbookState & WorkbookActions;

const initialState: WorkbookState = {
  config: {
    name: "",
    sheets: [],
  },
  currentSheet: "",
  importedData: null,
  mappingState: {},
  processedData: [],
  validationErrors: [],
  isLoading: false,
  processingProgress: 0,
  pipelineMappings: undefined,
  transformRegistry: defaultTransforms,
  validationRegistry: undefined,
};

export const createWorkbookStore = (): StoreApi<WorkbookStore> =>
  createStore<WorkbookStore>()((set, get) => ({
    ...initialState,

      setConfig: (config) => {
        set({
          config,
          transformRegistry: config.transformRegistry || defaultTransforms,
          validationRegistry: config.validationRegistry,
        });
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
        const state = get();
        const currentSheetConfig = state.config.sheets?.find(
          (sheet) => sheet.slug === state.currentSheet
        );

        if (currentSheetConfig) {
          let pipelineMappings = currentSheetConfig.pipelineMappings;
          if (!pipelineMappings) {
            const autoMapping = generateAutoMapping(
              data.headers,
              currentSheetConfig.fields,
              currentSheetConfig.mappingConfidenceThreshold
            );
            set({ mappingState: autoMapping });
            const fm = mappingStateToFieldMappings(autoMapping).map((m) => {
              const f = currentSheetConfig.fields.find((x) => x.key === m.target);
              return f?.defaultTransform
                ? { ...m, transform: f.defaultTransform }
                : m;
            });
            pipelineMappings = {
              fieldMappings: fm,
            };
          } else {
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

          set({
            pipelineMappings,
            processedData: [],
            validationErrors: [],
            isLoading: false,
          });
        }
      },

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
        const vRegistry = state.validationRegistry;
        const runId = ++processingRunId;
        set({ isLoading: true, processingProgress: 0 });
        const BATCH =
          state.config?.processing?.chunkSize && state.config.processing.chunkSize > 0
            ? state.config.processing.chunkSize
            : 2000;
        const processed: DataRow[] = [];
        const total = rows.length || 1;

        for (let start = 0; start < rows.length; start += BATCH) {
          if (runId !== processingRunId) {
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
                const tName = transform ?? field.defaultTransform;
                v = applyNamedTransform(v, tName, registry);
                const coerced = transformValue(v, field.type);
                out[target] = coerced;
                errors.push(
                  ...validateFieldWithRegistry(
                    coerced,
                    field,
                    index,
                    out,
                    vRegistry
                  )
                );
              }
            } else {
              for (const [sourceColumn, targetField] of Object.entries(
                state.mappingState
              )) {
                if (!targetField || row[sourceColumn] === undefined) continue;
                const field = fields.find((f) => f.key === targetField);
                if (!field) continue;
                let raw = row[sourceColumn];
                const tName = field.defaultTransform;
                raw = applyNamedTransform(raw, tName, registry);
                const coerced = transformValue(raw, field.type);
                out[targetField] = coerced;
                errors.push(
                  ...validateFieldWithRegistry(
                    coerced,
                    field,
                    index,
                    out,
                    vRegistry
                  )
                );
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
          if (runId !== processingRunId) return;
          set({ processedData: [...processed], processingProgress: Math.min(1, processed.length / total) });
          await new Promise((r) => setTimeout(r, 0));
        }

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
          processingProgress: 1,
        });
      },

      processOnContinue: async () => {
        const state = get();
        if (!state.importedData) return;
        const useChunk = Boolean(
          state.config?.processing?.chunkSize && state.config.processing.chunkSize > 0
        );
        if (useChunk) {
          await get().processDataChunked();
        } else {
          set({ isLoading: true });
          await Promise.resolve().then(() => get().processData());
          set({ isLoading: false });
        }
      },

      // Cancel any in-flight processing
      cancelProcessing: () => {
        // Bump run id so any loop exits
        processingRunId++;
        set({ isLoading: false, processingProgress: 0 });
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
        get().cancelProcessing();
        set({ processedData: [], validationErrors: [] });
      },

      updateMapping: (sourceColumn, targetField) => {
        const state = get();
        const currentSheetConfig = state.config.sheets?.find(
          (s) => s.slug === state.currentSheet
        );
        const newMapping: MappingState = { ...state.mappingState };
        if (targetField) {
          for (const [src, tgt] of Object.entries(newMapping)) {
            if (src !== sourceColumn && tgt === targetField) newMapping[src] = null;
          }
        }
        newMapping[sourceColumn] = targetField;

        const existing = state.pipelineMappings?.fieldMappings || [];
        let next: FieldMapping[] = existing.filter((m) => m.source !== sourceColumn);
        if (targetField) {
          next = next.filter((m) => m.target !== targetField);
          let transform = existing.find((m) => m.source === sourceColumn)?.transform;
          if (!transform && currentSheetConfig) {
            const f = currentSheetConfig.fields.find((x) => x.key === targetField);
            transform = f?.defaultTransform;
          }
          next.push({ source: sourceColumn, target: targetField, transform });
        }

        set({
          mappingState: newMapping,
          pipelineMappings: {
            ...(state.pipelineMappings || {}),
            fieldMappings: next,
          },
        });
        get().cancelProcessing();
        set({ processedData: [], validationErrors: [] });
      },

      setFieldMappings: (fieldMappings) => {
        const state = get();
        const byTarget = new Map<string, FieldMapping>();
        for (const m of fieldMappings || []) {
          if (!m.target) continue;
          byTarget.set(m.target, { ...m });
        }
        const compacted: FieldMapping[] = Array.from(byTarget.values());
        set({
          pipelineMappings: {
            ...(state.pipelineMappings || {}),
            fieldMappings: compacted,
          },
          mappingState: fieldMappingsToMappingState(compacted),
        });
        get().cancelProcessing();
        set({ processedData: [], validationErrors: [] });
      },

      setTransformRegistry: (registry) => {
        set({ transformRegistry: registry });
        get().cancelProcessing();
        set({ processedData: [], validationErrors: [] });
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
          const fm = mappingStateToFieldMappings(autoMapping).map((m) => {
            const f = currentSheetConfig.fields.find((x) => x.key === m.target);
            return f?.defaultTransform ? { ...m, transform: f.defaultTransform } : m;
          });
          set({
            mappingState: autoMapping,
            pipelineMappings: {
              fieldMappings: fm,
            },
          });
          get().cancelProcessing();
          set({ processedData: [], validationErrors: [] });
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
                state.transformRegistry || defaultTransforms,
                state.validationRegistry
              )
            : processImportedDataWithMappings(
                state.importedData,
                currentSheetConfig.fields,
                { fieldMappings: mappingStateToFieldMappings(state.mappingState) },
                state.transformRegistry || defaultTransforms,
                state.validationRegistry
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

            const field = currentSheetConfig.fields.find(
              (f) => f.key === fieldKey
            );
            const errors = row.errors.filter((e) => e.field !== fieldKey);

            if (field) {
              const rowIndex = state.processedData.findIndex(
                (r) => r.id === rowId
              );
              const fieldErrors = validateFieldWithRegistry(
                value,
                field,
                rowIndex,
                newData,
                state.validationRegistry
              );
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

        const validationErrors = updatedData.flatMap((row) => row.errors);
        set({ validationErrors });
      },

      deleteRow: (rowId) => {
        const state = get();
        const updatedData = state.processedData.filter(
          (row) => row.id !== rowId
        );
        set({ processedData: updatedData });

        const validationErrors = updatedData.flatMap((row) => row.errors);
        set({ validationErrors });
      },

      deleteInvalidRows: () => {
        const state = get();
        const kept = state.processedData.filter((row) => row.isValid);
        set({ processedData: kept });
        const validationErrors = kept.flatMap((row) => row.errors || []);
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
  }));
