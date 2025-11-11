"use client";

import React, { useMemo } from "react";
import FilefeedWorkbook from "../components/FilefeedWorkbook";
import type { FilefeedSDKProps, CreateWorkbookConfig, DataRow } from "../types";
import { FileFeedListener } from "./listener";
import { createSession } from "./session";

// Compatibility signature with @flatfile/react's useSpace
// Only the properties used by your codepaths are handled.
export type UseSpaceOptions = {
  name?: string;
  publishableKey?: string;
  environmentId?: string;
  listener: FileFeedListener;
  workbook: Pick<CreateWorkbookConfig, "name" | "labels" | "sheets" | "actions">;
  sidebarConfig?: { showSidebar?: boolean };
  closeSpace?: { operation?: string; onClose?: () => void };
  displayAsModal?: boolean;
  iframeStyles?: React.CSSProperties;
};

export function useSpace(opts: UseSpaceOptions) {
  const { listener, workbook, closeSpace } = opts;

  const el = useMemo(() => {
    const config: CreateWorkbookConfig = {
      name: workbook.name,
      labels: workbook.labels,
      sheets: workbook.sheets as any,
      actions: workbook.actions,
    };

    const props: FilefeedSDKProps = {
      config,
      events: {
        onWorkbookComplete: (rows: DataRow[]) => {
          const firstSheet = (workbook.sheets || [])[0] as any;
          const sheetSlug: string = firstSheet?.slug || "sheet";
          const sheetName: string = firstSheet?.name || sheetSlug;
          const { jobId, workbookId } = createSession({
            rows,
            sheetSlug,
            sheetName,
            closeOperation: closeSpace?.operation,
            onClose: closeSpace?.onClose,
          });
          // Fire the job:ready event so the provided listener can run the pipeline
          const op = closeSpace?.operation || "submitActionFg";
          const job = `workbook:${op}`;
          listener.emit("job:ready", { job, context: { jobId, workbookId } });
        },
      },
    };

    // Return a React element to mount like the original `useSpace` would render an iFrame.
    return React.createElement(FilefeedWorkbook, props as any);
  }, [listener, JSON.stringify(workbook), !!closeSpace?.operation]);

  return el;
}
