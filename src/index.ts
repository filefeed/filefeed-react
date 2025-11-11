// Main SDK exports
export { default as FilefeedWorkbook } from "./components/FilefeedWorkbook";
export { FilefeedProvider } from "./provider/FilefeedProvider";
export { useFilefeed } from "./hooks/useFilefeed";
export { FilefeedSheet } from "./components/FilefeedSheet";
export type { Filefeed } from "./types/filefeedTypes";

// Type exports
export type {
  CreateWorkbookConfig,
  ProcessingOptions,
  SheetConfig,
  FieldConfig,
  ValidationRule,
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

// Default export for convenience
export { default } from "./components/FilefeedWorkbook";
