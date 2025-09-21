// Main SDK exports
export { default as FilefeedWorkbook } from "./components/FilefeedWorkbook";
export { Providers as FilefeedProvider } from "./app/providers";

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
// Backend offload client configuration
export {
  configureBackendClient,
  isBackendClientConfigured,
  offloadAndProcessFile,
  OFFLOAD_THRESHOLD_BYTES,
} from "./utils/backendClient";

// Default export for convenience
export { default } from "./components/FilefeedWorkbook";
