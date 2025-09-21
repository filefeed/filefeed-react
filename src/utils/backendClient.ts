import { DataRow, PipelineMappings, CreateWorkbookConfig } from "../types";

// Hardcoded 10MB threshold for local vs. server processing
export const OFFLOAD_THRESHOLD_BYTES = 10 * 1024 * 1024;

// Handlers must be configured by the app owner (not end users)
export interface BackendClientHandlers {
  // Return an upload destination for the raw file (typically a presigned URL)
  getUploadUrl: (
    file: File,
    ctx: OffloadContext
  ) => Promise<{ url: string; method?: "PUT" | "POST"; fields?: Record<string, string>; headers?: Record<string, string>; key?: string }>;

  // Start processing for the uploaded file and return a job ID
  startProcessing: (
    args: {
      file: File;
      uploadKey?: string; // optional storage key/path
      ctx: OffloadContext;
    }
  ) => Promise<{ jobId: string }>;

  // Poll for job completion; when done, return processed rows compatible with the SDK
  pollResult: (
    jobId: string,
    ctx: OffloadContext
  ) => Promise<{ done: boolean; error?: string; rows?: DataRow[] }>;
}

export interface OffloadContext {
  sheetSlug: string;
  pipelineMappings?: PipelineMappings;
  workbook?: CreateWorkbookConfig;
}

let handlers: BackendClientHandlers | null = null;

export function configureBackendClient(h: BackendClientHandlers) {
  handlers = h;
}

export function isBackendClientConfigured(): boolean {
  return handlers !== null;
}

// Internal backoff config (not exported to keep API surface minimal)
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const INITIAL_DELAY_MS = 1000; // 1s
const MAX_DELAY_MS = 10000; // 10s
const BACKOFF_FACTOR = 1.5; // 1.0, 1.5, 2.25, ...
const JITTER_RATIO = 0.2; // +/-20%

function withJitter(ms: number): number {
  const jitter = ms * JITTER_RATIO;
  const min = Math.max(250, ms - jitter);
  const max = ms + jitter;
  return Math.floor(min + Math.random() * (max - min));
}

export async function offloadAndProcessFile(file: File, ctx: OffloadContext): Promise<DataRow[]> {
  if (!handlers) {
    throw new Error("Backend client is not configured");
  }

  // 1) Get upload destination
  const upload = await handlers.getUploadUrl(file, ctx);

  // 2) Upload the file
  if (upload.method === "POST" && upload.fields) {
    // Multipart/form-data style (S3 POST)
    const form = new FormData();
    Object.entries(upload.fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", file);
    const res = await fetch(upload.url, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
  } else {
    // Default to simple PUT
    const res = await fetch(upload.url, {
      method: upload.method || "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream", ...(upload.headers || {}) },
    });
    if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
  }

  // 3) Start processing
  const { jobId } = await handlers.startProcessing({ file, uploadKey: upload.key, ctx });

  // 4) Poll for result with exponential backoff and jitter
  const start = Date.now();
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let attempt = 0;
  let waitMs = INITIAL_DELAY_MS;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - start > POLL_TIMEOUT_MS) {
      throw new Error("Processing timed out");
    }

    try {
      const status = await handlers.pollResult(jobId, ctx);
      if (status.done) {
        if (status.error) throw new Error(status.error);
        return status.rows || [];
      }
    } catch (err) {
      // Swallow transient errors during polling and continue with backoff
      // You can log err for diagnostics if desired
    }

    await delay(withJitter(waitMs));
    attempt += 1;
    waitMs = Math.min(MAX_DELAY_MS, Math.floor(waitMs * BACKOFF_FACTOR));
  }
}
