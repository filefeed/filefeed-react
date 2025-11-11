// Main SDK exports
export { default as FilefeedWorkbook } from "./components/FilefeedWorkbook";
export { FilefeedProvider } from "./provider/FilefeedProvider";
export { useFilefeed } from "./hooks/useFilefeed";
export { useFilefeedEvent } from "./hooks/useFilefeedEvent";
export { FilefeedSheet } from "./components/FilefeedSheet";
export type { Filefeed } from "./types/filefeedTypes";

// Flatfile compatibility layer (client-side shims)
export { api } from "./compat/api";
export { useSpace } from "./compat/useSpace";
export { FileFeedListener } from "./compat/listener";
export type { FileFeed } from "./compat/types";

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
