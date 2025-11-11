export interface CreateWorkbookConfig {
  name: string;
  labels?: string[];
  namespace?: string;
  spaceId?: string;
  environmentId?: string;
  metadata?: any;
  sheets?: SheetConfig[];
  transformRegistry?: TransformRegistry;
  validationRegistry?: ValidationRegistry;
  processing?: ProcessingOptions;
}

export interface SheetConfig {
  name: string;
  slug: string;
  fields: FieldConfig[];
  mappingConfidenceThreshold?: number;
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
  defaultTransform?: string;
}

export interface ValidationRule {
  type: "regex" | "min" | "max" | "custom";
  value?: any;
  message: string;
  name?: string;
  args?: any;
}


export interface ProcessingOptions {
  chunkSize?: number;
  submitInChunks?: boolean;
}

export interface ImportedData {
  headers: string[];
  rows: Record<string, any>[];
  fileName?: string;
  fileType?: string;
}

export interface MappingState {
  [sourceColumn: string]: string | null;
}

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
  transformations?: Record<string, string>;
  validations?: Record<string, any>;
  [key: string]: any;
}
export type TransformRegistry = Record<string, (value: any) => any>;
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
  pipelineMappings?: PipelineMappings;
  transformRegistry?: TransformRegistry;
  validationRegistry?: ValidationRegistry;
  processingProgress?: number;
}
export interface FilefeedEvents {
  onDataImported?: (data: ImportedData) => void;
  onMappingChanged?: (mapping: MappingState) => void;
  onValidationComplete?: (errors: ValidationError[]) => void;
  onWorkbookComplete?: (data: DataRow[]) => void;
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
export interface FilefeedSDKProps {
  config: CreateWorkbookConfig;
  events?: FilefeedEvents;
  theme?: "light" | "dark";
  className?: string;
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
  fieldMappings?: FieldMapping[];
  onFieldMappingsChange?: (mappings: FieldMapping[]) => void;
  transformRegistry?: TransformRegistry;
  isProcessing?: boolean;
  canContinue?: boolean;
  processingProgress?: number;
}

export interface FilefeedWorkbookRef {
  reset: () => void;
  cancelProcessing: () => void;
}
