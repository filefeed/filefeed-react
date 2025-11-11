import { useState } from "react";
import type {
  CreateWorkbookConfig,
  PipelineMappings,
  DataRow,
  ImportedData,
} from "../types";

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
      const { parseCSV, parseExcel } = await import("../utils/dataProcessing");
      const data = file.name.toLowerCase().endsWith(".csv")
        ? await parseCSV(file)
        : await parseExcel(file);
      onImported(data);
    } catch (error) {
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
