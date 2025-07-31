"use client";

import React, { useCallback } from "react";
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import { Group, Text, rem, Stack, Alert } from "@mantine/core";
import {
  IconUpload,
  IconX,
  IconFile,
  IconAlertCircle,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { FileImportProps, ImportedData } from "../types";
import { parseCSV, parseExcel } from "../utils/dataProcessing";

const FileImport: React.FC<FileImportProps> = ({
  onDataImported,
  acceptedTypes = [".csv", ".xlsx", ".xls"],
  maxFileSize = 5 * 1024 * 1024, // 5MB default
}) => {
  const handleFileDrop = useCallback(
    async (files: FileWithPath[]) => {
      if (files.length === 0) return;

      const file = files[0];

      try {
        let importedData: ImportedData;

        if (file.name.toLowerCase().endsWith(".csv")) {
          importedData = await parseCSV(file);
        } else if (
          file.name.toLowerCase().endsWith(".xlsx") ||
          file.name.toLowerCase().endsWith(".xls")
        ) {
          importedData = await parseExcel(file);
        } else {
          throw new Error("Unsupported file type");
        }

        notifications.show({
          title: "File imported successfully",
          message: `Imported ${importedData.rows.length} rows from ${file.name}`,
          color: "green",
        });

        onDataImported(importedData);
      } catch (error) {
        notifications.show({
          title: "Import failed",
          message:
            error instanceof Error ? error.message : "Failed to import file",
          color: "red",
        });
      }
    },
    [onDataImported]
  );

  const handleFileReject = useCallback(
    (fileRejections: any[]) => {
      const rejection = fileRejections[0];
      let message = "File rejected";

      if (rejection?.file?.size > maxFileSize) {
        message = `File size exceeds ${Math.round(
          maxFileSize / 1024 / 1024
        )}MB limit`;
      } else {
        message = "File type not supported";
      }

      notifications.show({
        title: "File rejected",
        message,
        color: "red",
      });
    },
    [maxFileSize]
  );

  return (
    <Stack gap="md">
      <Dropzone
        onDrop={handleFileDrop}
        onReject={handleFileReject}
        maxSize={maxFileSize}
        accept={acceptedTypes.reduce((acc, type) => {
          if (type === ".csv") acc["text/csv"] = [".csv"];
          if (type === ".xlsx" || type === ".xls") {
            acc[
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ] = [".xlsx"];
            acc["application/vnd.ms-excel"] = [".xls"];
          }
          return acc;
        }, {} as Record<string, string[]>)}
        radius="md"
        style={{
          border: "2px dashed var(--mantine-color-gray-4)",
          backgroundColor: "var(--mantine-color-gray-0)",
          transition: "all 0.2s ease",
        }}
      >
        <Group
          justify="center"
          gap="xl"
          mih={280}
          style={{ pointerEvents: "none" }}
        >
          <Dropzone.Accept>
            <div style={{ textAlign: "center" }}>
              <IconUpload
                style={{
                  width: rem(64),
                  height: rem(64),
                  color: "var(--mantine-color-blue-6)",
                  margin: "0 auto 16px",
                }}
                stroke={1.5}
              />
              <Text size="lg" fw={600} c="blue">
                Drop your file here
              </Text>
            </div>
          </Dropzone.Accept>
          <Dropzone.Reject>
            <div style={{ textAlign: "center" }}>
              <IconX
                style={{
                  width: rem(64),
                  height: rem(64),
                  color: "var(--mantine-color-red-6)",
                  margin: "0 auto 16px",
                }}
                stroke={1.5}
              />
              <Text size="lg" fw={600} c="red">
                File not supported
              </Text>
            </div>
          </Dropzone.Reject>
          <Dropzone.Idle>
            <div style={{ textAlign: "center" }}>
              <IconFile
                style={{
                  width: rem(64),
                  height: rem(64),
                  color: "var(--mantine-color-gray-5)",
                  margin: "0 auto 16px",
                }}
                stroke={1.5}
              />
              <Text size="xl" fw={600} c="gray.8" mb={8}>
                Choose a file or drag it here
              </Text>
              <Text size="md" c="gray.6" mb={16}>
                Upload CSV or Excel files up to{" "}
                {Math.round(maxFileSize / 1024 / 1024)}MB
              </Text>
              <Group justify="center" gap="sm">
                <Text size="sm" c="gray.5">
                  Supported formats:
                </Text>
                <Group gap={4}>
                  <Text size="sm" fw={500} c="gray.7">
                    .CSV
                  </Text>
                  <Text size="sm" c="gray.4">
                    •
                  </Text>
                  <Text size="sm" fw={500} c="gray.7">
                    .XLSX
                  </Text>
                  <Text size="sm" c="gray.4">
                    •
                  </Text>
                  <Text size="sm" fw={500} c="gray.7">
                    .XLS
                  </Text>
                </Group>
              </Group>
            </div>
          </Dropzone.Idle>
        </Group>
      </Dropzone>

      <Alert
        icon={<IconAlertCircle size="1rem" />}
        title="Supported formats"
        color="blue"
        variant="light"
      >
        <Text size="sm">
          • CSV files (.csv) - Comma-separated values
          <br />
          • Excel files (.xlsx, .xls) - Microsoft Excel spreadsheets
          <br />• First row should contain column headers
        </Text>
      </Alert>
    </Stack>
  );
};

export default FileImport;
