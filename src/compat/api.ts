import type { DataRow } from "../types";
import { getSessionByWorkbook, getSessionBySheet, ackJob, completeJob, failJob } from "./session";

function toRecordValues(row: DataRow) {
  const values: Record<string, { value: any }> = {};
  const data = row.data || {};
  for (const [k, v] of Object.entries(data)) {
    values[k] = { value: v };
  }
  return { values } as { values: Record<string, { value: any }> };
}

export const api = {
  sheets: {
    async list({ workbookId }: { workbookId: string }) {
      const s = getSessionByWorkbook(workbookId);
      const id = s?.sheetId || "sheet_1";
      const slug = s?.sheetSlug || "sheet";
      const name = s?.sheetName || slug;
      return {
        data: [
          {
            id,
            slug,
            name,
          },
        ],
      };
    },
  },
  records: {
    async get(
      sheetId: string,
      opts: { includeLength?: boolean; pageSize?: number; pageNumber?: number } = {}
    ) {
      const s = getSessionBySheet(sheetId);
      const rows = s?.rows || [];
      const total = rows.length;
      const size = Math.max(1, Math.min(opts.pageSize || 100, 10000));
      const page = Math.max(1, opts.pageNumber || 1);
      const start = (page - 1) * size;
      const end = Math.min(start + size, total);
      const slice = rows.slice(start, end);
      return {
        data: {
          records: slice.map(toRecordValues),
          counts: { total },
        },
      };
    },
  },
  jobs: {
    async ack(jobId: string, args: { info?: string; progress?: number }) {
      ackJob(jobId, args?.progress);
      return {};
    },
    async complete(jobId: string, args: { outcome?: { message?: string } }) {
      completeJob(jobId, args?.outcome);
      return {};
    },
    async fail(jobId: string, args: { outcome?: { message?: string } }) {
      failJob(jobId, args?.outcome);
      return {};
    },
  },
};
