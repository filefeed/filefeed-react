import { useState } from "react";
import type {
  CreateWorkbookConfig,
  PipelineMappings,
  DataRow,
  ImportedData,
} from "../types";
import {
  OFFLOAD_THRESHOLD_BYTES,
  isBackendClientConfigured,
  offloadAndProcessFile,
} from "../utils/backendClient";

interface UseFileImportArgs {
  currentSheet: string;
  pipelineMappings?: PipelineMappings;
  config: CreateWorkbookConfig;
  onImported: (data: ImportedData) => void;
  setProcessedRows: (rows: DataRow[]) => void;
  setLoading: (v: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export function useFileImport({
  currentSheet,
  pipelineMappings,
  config,
  onImported,
  setProcessedRows,
  setLoading,
  setActiveTab,
}: UseFileImportArgs) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (file: File) => {
    try {
      setIsUploading(true);
      if (file.size > OFFLOAD_THRESHOLD_BYTES && isBackendClientConfigured()) {
        setLoading(true);
        try {
          const rows = await offloadAndProcessFile(file, {
            sheetSlug: currentSheet,
            pipelineMappings,
            workbook: config,
          });
          setProcessedRows(rows);
          setActiveTab("review");
        } finally {
          setLoading(false);
        }
      } else {
        const { parseCSV, parseExcel } = await import("../utils/dataProcessing");
        const data = file.name.toLowerCase().endsWith(".csv")
          ? await parseCSV(file)
          : await parseExcel(file);
        onImported(data);
      }
    } catch (error) {
      // Surface in console for now; can be wired to onError later
      // eslint-disable-next-line no-console
      console.error("Error processing file:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx,.xls";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) await handleFile(file);
    };
    input.click();
  };

  return { isUploading, triggerFilePicker, handleFile } as const;
}
