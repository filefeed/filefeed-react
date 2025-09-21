// Main SDK exports
export { default as FilefeedWorkbook } from "./components/FilefeedWorkbook";
// Public provider export for consumers who want to wrap components manually
export { Providers as FilefeedProvider } from "./app/providers";

// (No store exports — internal by default)

// Type exports
export type {
  CreateWorkbookConfig,
  SheetConfig,
  FieldConfig,
  ValidationRule,
  Action,
  WorkbookSettings,
  ImportedData,
  MappingState,
  ValidationError,
  DataRow,
  WorkbookState,
  FilefeedEvents,
  FilefeedSDKProps,
  // New types for backend-compatible mapping
  FieldMapping,
  PipelineMappings,
  TransformRegistry,
} from "./types";

// Utility exports
export {
  parseCSV,
  parseExcel,
  validateField,
  transformValue,
  generateAutoMapping,
  processImportedData,
  // Backend-compatible utilities
  defaultTransforms,
  applyNamedTransform,
  mappingStateToFieldMappings,
  fieldMappingsToMappingState,
  validatePipelineConfig,
  processImportedDataWithMappings,
} from "./utils/dataProcessing";

// Backend offload client configuration
export {
  configureBackendClient,
  isBackendClientConfigured,
  offloadAndProcessFile,
  OFFLOAD_THRESHOLD_BYTES,
} from "./utils/backendClient";

// Default export for convenience
export { default } from "./components/FilefeedWorkbook";
