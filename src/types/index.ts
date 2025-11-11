// Core configuration interfaces for the filefeed-sdk
export interface CreateWorkbookConfig {
  name: string;
  labels?: string[];
  namespace?: string;
  spaceId?: string;
  environmentId?: string;
  metadata?: any;
  sheets?: SheetConfig[];
  actions?: Action[];
  settings?: WorkbookSettings;
  // Optional registries that can be provided by consumers
  transformRegistry?: TransformRegistry;
  validationRegistry?: ValidationRegistry;
  // Processing behavior configuration
  processing?: ProcessingOptions;
}

export interface SheetConfig {
  name: string;
  slug: string;
  fields: FieldConfig[];
  mappingConfidenceThreshold?: number;
  // Optional backend-compatible mappings for lightweight client-side processing
  pipelineMappings?: PipelineMappings;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: "string" | "number" | "email" | "date" | "boolean";
  required?: boolean;
  unique?: boolean;
  validations?: ValidationRule[];
  description?: string;
  // Default transform to apply when this field is mapped (unless overridden by mapping-level transform)
  defaultTransform?: string;
}

export interface ValidationRule {
  type: "regex" | "min" | "max" | "custom";
  value?: any;
  message: string;
  // For custom validation, lookup by name in ValidationRegistry
  name?: string;
  // Optional arguments passed to the custom validator
  args?: any;
}

export interface Action {
  operation: string;
  label: string;
  description?: string;
  primary?: boolean;
  mode: "foreground" | "background";
}

export interface WorkbookSettings {
  trackChanges?: boolean;
}

// Controls how client-side processing runs
export interface ProcessingOptions {
  // Number of rows to process per batch during mapping/validation
  chunkSize?: number;
  // If true, UI will prefer submitting in chunks when possible
  submitInChunks?: boolean;
}

// Additional types for internal SDK functionality
export interface ImportedData {
  headers: string[];
  rows: Record<string, any>[];
  fileName?: string;
  fileType?: string;
}

export interface MappingState {
  [sourceColumn: string]: string | null; // maps to field key
}

// New mapping types aligned with backend structure
export interface FieldMapping {
  source: string;
  target: string;
  transform?: string;
  confidence?: number;
}

export interface PipelineMappings {
  options?: {
    delimiter?: string;
    skipHeaderRow?: boolean;
    detectTypes?: boolean;
    validateData?: boolean;
  };
  fieldMappings: FieldMapping[];
  // For server-side compatibility (backend expects transform code strings)
  transformations?: Record<string, string>;
  validations?: Record<string, any>;
  [key: string]: any;
}

// Frontend-only registry of transform implementations
export type TransformRegistry = Record<string, (value: any) => any>;

// Frontend-only registry of validation implementations (custom per-field)
export type ValidationRegistry = Record<
  string,
  (
    value: any,
    field: FieldConfig,
    rowIndex: number,
    rowData: Record<string, any>,
    args?: any
  ) => string | ValidationError | null | undefined | boolean
>;

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface DataRow {
  id: string;
  data: Record<string, any>;
  errors: ValidationError[];
  isValid: boolean;
}

export interface WorkbookState {
  config: CreateWorkbookConfig;
  currentSheet: string;
  importedData: ImportedData | null;
  mappingState: MappingState;
  processedData: DataRow[];
  validationErrors: ValidationError[];
  isLoading: boolean;
  // Backend-compatible structures (optional in state)
  pipelineMappings?: PipelineMappings;
  transformRegistry?: TransformRegistry;
  validationRegistry?: ValidationRegistry;
  // 0..1 progress for background processing
  processingProgress?: number;
}

// Event types for SDK callbacks
export interface FilefeedEvents {
  onDataImported?: (data: ImportedData) => void;
  onMappingChanged?: (mapping: MappingState) => void;
  onValidationComplete?: (errors: ValidationError[]) => void;
  onActionTriggered?: (action: Action, data: DataRow[]) => void;
  onWorkbookComplete?: (data: DataRow[]) => void;
  // Optional: called when submitting via chunks
  onSubmitChunk?: (args: {
    rows: DataRow[];
    chunkIndex: number;
    totalChunks: number;
  }) => void | Promise<void>;
  onSubmitStart?: () => void;
  onSubmitComplete?: () => void;
  onStepChange?: (step: "import" | "mapping" | "review") => void;
  onReset?: () => void;
}

// Component props
export interface FilefeedSDKProps {
  config: CreateWorkbookConfig;
  events?: FilefeedEvents;
  theme?: "light" | "dark";
  className?: string;
}

export interface FileImportProps {
  onDataImported: (data: ImportedData) => void;
  acceptedTypes?: string[];
  maxFileSize?: number;
  // Internal: called when large file offload completes with processed rows
  onOffloadComplete?: (rows: DataRow[]) => void;
  // Internal: context used to offload large files automatically
  offloadContext?: {
    sheetSlug: string;
    pipelineMappings?: PipelineMappings;
    workbook?: CreateWorkbookConfig;
  };
}

export interface DataTableProps {
  data: DataRow[];
  fields: FieldConfig[];
  onDataChange: (data: DataRow[]) => void;
  editable?: boolean;
}

export interface MappingInterfaceProps {
  importedHeaders: string[];
  fields: FieldConfig[];
  mapping: MappingState;
  onMappingChange: (mapping: MappingState) => void;
  confidenceThreshold?: number;
  importedData?: ImportedData;
  onBack?: () => void;
  onContinue?: () => void;
  onExit?: () => void;
  // New optional props for advanced mapping with transforms
  fieldMappings?: FieldMapping[];
  onFieldMappingsChange?: (mappings: FieldMapping[]) => void;
  transformRegistry?: TransformRegistry;
  // Background processing state and readiness
  isProcessing?: boolean;
  canContinue?: boolean;
  processingProgress?: number;
}

// Imperative ref interface for FilefeedWorkbook component
export interface FilefeedWorkbookRef {
  reset: () => void;
}
