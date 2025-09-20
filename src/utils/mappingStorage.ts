import { CreateWorkbookConfig, FieldConfig, FieldMapping } from "@/types";

const STORAGE_PREFIX = "filefeed:mapping:";

const safeWindow = (): Window | null =>
  typeof window !== "undefined" ? window : null;

function keyFor(config: CreateWorkbookConfig, sheetSlug: string): string {
  const ns = config.namespace || config.name || "default";
  return `${STORAGE_PREFIX}${ns}:${sheetSlug}`;
}

function schemaSignature(fields: FieldConfig[]): string {
  const keys = [...fields.map((f) => f.key)].sort();
  return JSON.stringify(keys);
}

export function saveFieldMappings(
  config: CreateWorkbookConfig,
  sheetSlug: string,
  mappings: FieldMapping[],
  fields: FieldConfig[]
) {
  const w = safeWindow();
  if (!w) return;
  const payload = {
    version: 1,
    schema: schemaSignature(fields),
    mappings,
    savedAt: Date.now(),
  };
  try {
    w.localStorage.setItem(keyFor(config, sheetSlug), JSON.stringify(payload));
  } catch {
    // ignore quota or privacy-mode errors
  }
}

export function loadFieldMappings(
  config: CreateWorkbookConfig,
  sheetSlug: string,
  fields: FieldConfig[]
): FieldMapping[] | null {
  const w = safeWindow();
  if (!w) return null;
  try {
    const raw = w.localStorage.getItem(keyFor(config, sheetSlug));
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.mappings || !payload.schema) return null;
    if (payload.schema !== schemaSignature(fields)) return null;
    return payload.mappings as FieldMapping[];
  } catch {
    return null;
  }
}

export function clearFieldMappings(
  config: CreateWorkbookConfig,
  sheetSlug: string
) {
  const w = safeWindow();
  if (!w) return;
  try {
    w.localStorage.removeItem(keyFor(config, sheetSlug));
  } catch {
    // ignore errors
  }
}
