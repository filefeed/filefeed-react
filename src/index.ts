// Main SDK exports
export { default as FilefeedWorkbook } from "./components/FilefeedWorkbook";
export { default as FileImport } from "./components/FileImport";
export { default as DataTable } from "./components/DataTable";
export { default as MappingInterface } from "./components/MappingInterface";

// Store exports
export { useWorkbookStore } from "./stores/workbookStore";

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
  FileImportProps,
  DataTableProps,
  MappingInterfaceProps,
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
