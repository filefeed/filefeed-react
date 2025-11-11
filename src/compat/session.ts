import type { DataRow } from "../types";

export type Session = {
  jobId: string;
  workbookId: string;
  sheetId: string;
  sheetSlug: string;
  sheetName?: string;
  rows: DataRow[];
  counts: { total: number };
  progress?: number;
  outcome?: { message?: string };
  closeOperation?: string;
  onClose?: () => void;
};

const byJob = new Map<string, Session>();
const byWorkbook = new Map<string, Session>();
const bySheet = new Map<string, Session>();

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSession(args: {
  rows: DataRow[];
  sheetSlug: string;
  sheetName?: string;
  closeOperation?: string;
  onClose?: () => void;
}) {
  const jobId = rid("job");
  const workbookId = rid("wb");
  const sheetId = rid("sh");
  const s: Session = {
    jobId,
    workbookId,
    sheetId,
    sheetSlug: args.sheetSlug,
    sheetName: args.sheetName,
    rows: args.rows || [],
    counts: { total: (args.rows || []).length },
    progress: 0,
    closeOperation: args.closeOperation,
    onClose: args.onClose,
  };
  byJob.set(jobId, s);
  byWorkbook.set(workbookId, s);
  bySheet.set(sheetId, s);
  return { jobId, workbookId, sheetId };
}

export function getSessionByWorkbook(workbookId: string) {
  return byWorkbook.get(workbookId);
}

export function getSessionBySheet(sheetId: string) {
  return bySheet.get(sheetId);
}

export function getSessionByJob(jobId: string) {
  return byJob.get(jobId);
}

export function ackJob(jobId: string, progress?: number) {
  const s = byJob.get(jobId);
  if (s) s.progress = progress ?? s.progress;
}

export function completeJob(jobId: string, outcome?: { message?: string }) {
  const s = byJob.get(jobId);
  if (s) {
    s.outcome = outcome;
    // auto-close if close op configured (submitActionFg is common)
    try {
      s.onClose?.();
    } catch {}
  }
}

export function failJob(jobId: string, outcome?: { message?: string }) {
  const s = byJob.get(jobId);
  if (s) {
    s.outcome = outcome;
    try {
      s.onClose?.();
    } catch {}
  }
}
