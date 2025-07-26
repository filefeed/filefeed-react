// Core configuration interfaces for the cellvio-sdk
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
}

export interface SheetConfig {
  name: string;
  slug: string;
  fields: FieldConfig[];
  mappingConfidenceThreshold?: number;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: "string" | "number" | "email" | "date" | "boolean";
  required?: boolean;
  unique?: boolean;
  validations?: ValidationRule[];
  description?: string;
}

export interface ValidationRule {
  type: "regex" | "min" | "max" | "custom";
  value?: any;
  message: string;
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

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
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
}

// Event types for SDK callbacks
export interface CellvioEvents {
  onDataImported?: (data: ImportedData) => void;
  onMappingChanged?: (mapping: MappingState) => void;
  onValidationComplete?: (errors: ValidationError[]) => void;
  onActionTriggered?: (action: Action, data: DataRow[]) => void;
  onWorkbookComplete?: (data: DataRow[]) => void;
}

// Component props
export interface CellvioSDKProps {
  config: CreateWorkbookConfig;
  events?: CellvioEvents;
  theme?: 'light' | 'dark';
  className?: string;
}

export interface FileImportProps {
  onDataImported: (data: ImportedData) => void;
  acceptedTypes?: string[];
  maxFileSize?: number;
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
}