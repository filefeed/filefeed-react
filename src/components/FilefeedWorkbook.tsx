"use client";

import React, {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Container,
  Title,
  Text,
  Group,
  Button,
  Stack,
  LoadingOverlay,
  Card,
  Divider,
  Box,
  Flex,
  Table,
  ScrollArea,
} from "@mantine/core";
import { IconUpload, IconEdit } from "@tabler/icons-react";
import { FilefeedSDKProps, FilefeedWorkbookRef, DataRow } from "../types";
import { useWorkbookStore } from "../stores/workbookStore";
import MappingInterface from "./MappingInterface";
import { Providers } from "../app/providers";
import { useManualEntry } from "../hooks/useManualEntry";
import { useDynamicRowCount } from "../hooks/useDynamicRowCount";
import { useFileImport } from "../hooks/useFileImport";
import { transformValue, validateField } from "../utils/dataProcessing";

const FilefeedWorkbook = forwardRef<FilefeedWorkbookRef, FilefeedSDKProps>(
  ({ config, events, theme = "light", className }, ref) => {
    const [activeTab, setActiveTab] = useState<string>("import");
    const [isManualEntryMode, setIsManualEntryMode] = useState(false);

    const {
      setConfig,
      currentSheet,
      importedData,
      setImportedData,
      mappingState,
      updateMapping,
      processedData,
      isLoading,
      setLoading,
      pipelineMappings,
      setFieldMappings,
      transformRegistry,
      setProcessedRows,
      setMapping,
      clearImportedData,
      reset: resetStore,
    } = useWorkbookStore();

    const currentSheetConfig = config.sheets?.find(
      (sheet) => sheet.slug === currentSheet
    );

    const {
      manualEntryData,
      manualEntryErrors,
      selectedFilter,
      setSelectedFilter,
      isCalculatingValidation,
      totalRows,
      validRows,
      invalidRows,
      isRowVisible,
      handleManualEntryChange,
      reset: resetManual,
    } = useManualEntry(currentSheetConfig?.fields);

    const { setContainerRef: setTableContainerRef, maxRows } =
      useDynamicRowCount();

    useEffect(() => {
      setConfig(config);
    }, [config, setConfig]);
    useEffect(() => {
      if (events?.onStepChange) {
        if (
          activeTab === "import" ||
          activeTab === "mapping" ||
          activeTab === "review"
        ) {
          events.onStepChange(activeTab);
        }
      }
    }, [activeTab, events]);

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          resetStore();
          setConfig(config);
          setActiveTab("import");
          setIsManualEntryMode(false);
          resetManual();
          events?.onReset?.();
        },
      }),
      [config, resetStore, setConfig, events]
    );

    const { isUploading, triggerFilePicker } = useFileImport({
      currentSheet: currentSheet || "",
      pipelineMappings,
      config,
      onImported: (data) => {
        setImportedData(data);
        setActiveTab("mapping");
        events?.onDataImported?.(data);
      },
      setProcessedRows,
      setLoading,
      setActiveTab,
    });

    const handleMappingChange = (mapping: any) => {
      Object.entries(mapping).forEach(([sourceColumn, targetField]) => {
        updateMapping(sourceColumn, targetField as string | null);
      });
      events?.onMappingChanged?.(mapping);
    };

    // Build processed rows from manual entry state (independent of file upload)
    const buildManualProcessedData = (): DataRow[] => {
      if (!currentSheetConfig) return [];
      // Keep order stable by sorting by original manual index
      const entries = Object.entries(manualEntryData)
        .map(([rowId, data]) => ({
          rowId,
          index: Number(rowId.replace(/^manual-/, "")) || 0,
          data,
        }))
        // include only rows that have some data entered
        .filter(({ data }) =>
          Object.values(data || {}).some((v) => String(v ?? "").trim() !== "")
        )
        .sort((a, b) => a.index - b.index);

      return entries.map(({ index, data }) => {
        const processed: Record<string, any> = {};
        const errors: any[] = [];
        currentSheetConfig.fields.forEach((field) => {
          const raw = (data as any)[field.key];
          const coerced = transformValue(raw, field.type);
          processed[field.key] = coerced;
          errors.push(...validateField(coerced, field, index));
        });
        return {
          id: `manual-row-${index}`,
          data: processed,
          errors,
          isValid: errors.filter((e) => e.severity === "error").length === 0,
        } as DataRow;
      });
    };

    const hasManualRows = totalRows > 0;

    const handleSubmit = () => {
      if (isManualEntryMode && hasManualRows) {
        const manualRows = buildManualProcessedData();
        events?.onWorkbookComplete?.(manualRows);
      } else {
        events?.onWorkbookComplete?.(processedData);
      }
    };

    return (
      <Providers>
        <div
          className={`filefeed-workbook ${className || ""}`}
          data-theme={theme}
        >
          <LoadingOverlay visible={isLoading} />

          <Container size="xl" py="xl">
            {activeTab === "mapping" && importedData && currentSheetConfig ? (
              <Card shadow="sm" padding={0} radius="md" withBorder>
                <MappingInterface
                  importedHeaders={importedData.headers}
                  fields={currentSheetConfig.fields}
                  mapping={mappingState}
                  onMappingChange={handleMappingChange}
                  importedData={importedData}
                  onBack={() => setActiveTab("import")}
                  onContinue={() => setActiveTab("review")}
                  onExit={() => setActiveTab("import")}
                  fieldMappings={pipelineMappings?.fieldMappings}
                  onFieldMappingsChange={setFieldMappings}
                  transformRegistry={transformRegistry}
                />
              </Card>
            ) : activeTab === "review" && importedData && currentSheetConfig ? (
              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Group justify="space-between" align="center">
                  <Text size="sm" c="gray.8" fw={500}>
                    Review Mapped Data
                  </Text>
                  <Group gap="md">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setActiveTab("mapping")}
                      styles={{
                        root: {
                          backgroundColor: "white",
                          borderColor: "black",
                          color: "black",
                          "&:hover": {
                            backgroundColor: "var(--mantine-color-gray-0)",
                          },
                        },
                      }}
                    >
                      Back to Mapping
                    </Button>
                    <Button
                      size="xs"
                      radius="md"
                      onClick={() => {
                        events?.onWorkbookComplete?.(processedData);
                      }}
                      styles={{
                        root: {
                          backgroundColor: "black",
                          color: "white",
                          border: "none",
                          "&:hover": {
                            backgroundColor: "#333",
                          },
                        },
                      }}
                    >
                      Submit {currentSheetConfig?.name} Data
                    </Button>
                    <div
                      style={{
                        display: "flex",
                        backgroundColor: "var(--mantine-color-gray-1)",
                        borderRadius: "6px",
                        padding: "2px",
                        gap: "2px",
                      }}
                    >
                      {[
                        {
                          label: "All",
                          value: "all",
                          count: importedData.rows.length,
                        },
                        {
                          label: "Valid",
                          value: "valid",
                          count: importedData.rows.length,
                        },
                        { label: "Invalid", value: "invalid", count: 0 },
                      ].map((item) => (
                        <button
                          key={item.value}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: "none",
                            backgroundColor:
                              item.value === "all" ? "white" : "transparent",
                            color: "var(--mantine-color-gray-7)",
                            fontSize: "13px",
                            fontWeight: 500,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow:
                              item.value === "all"
                                ? "0 1px 2px rgba(0, 0, 0, 0.05)"
                                : "none",
                          }}
                        >
                          <span>{item.label}</span>
                          {item.count > 0 && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: "20px",
                                height: "20px",
                                borderRadius: "10px",
                                backgroundColor: "var(--mantine-color-gray-4)",
                                color: "white",
                                fontSize: "11px",
                                fontWeight: 600,
                              }}
                            >
                              {item.count}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </Group>
                </Group>

                <Divider my="md" />

                <ScrollArea h={600}>
                  <Table
                    striped={false}
                    highlightOnHover={true}
                    withTableBorder
                    withColumnBorders
                    style={{
                      backgroundColor: "white",
                      borderCollapse: "collapse",
                      width: "100%",
                    }}
                  >
                    <Table.Thead>
                      <Table.Tr
                        style={{
                          backgroundColor: "var(--mantine-color-gray-0)",
                        }}
                      >
                        {Object.entries(mappingState)
                          .filter(([_, targetField]) => targetField)
                          .map(([_, targetField]) => {
                            const field = currentSheetConfig.fields.find(
                              (f) => f.key === targetField
                            );
                            return (
                              <Table.Th
                                key={targetField}
                                style={{
                                  color: "var(--mantine-color-gray-8)",
                                  fontWeight: 500,
                                  fontSize: "12px",
                                  borderBottom:
                                    "1px solid var(--mantine-color-gray-3)",
                                  borderRight:
                                    "1px solid var(--mantine-color-gray-3)",
                                  backgroundColor:
                                    "var(--mantine-color-gray-0)",
                                  padding: "6px 10px",
                                  minWidth: "120px",
                                  position: "sticky",
                                  top: 0,
                                  zIndex: 1,
                                }}
                              >
                                {field?.label || targetField}
                              </Table.Th>
                            );
                          })}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {importedData.rows.map((row, index) => (
                        <Table.Tr key={index}>
                          {Object.entries(mappingState)
                            .filter(([_, targetField]) => targetField)
                            .map(([sourceHeader, targetField]) => (
                              <Table.Td
                                key={`${index}-${targetField}`}
                                style={{
                                  borderBottom:
                                    "1px solid var(--mantine-color-gray-3)",
                                  borderRight:
                                    "1px solid var(--mantine-color-gray-3)",
                                  padding: "6px 10px",
                                  fontSize: "12px",
                                  color: "var(--mantine-color-gray-8)",
                                  backgroundColor: "white",
                                }}
                              >
                                {row[sourceHeader] || ""}
                              </Table.Td>
                            ))}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Card>
            ) : (
              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Group justify="space-between" align="center">
                  <Text size="sm" c="gray.8" fw={500}>
                    {currentSheetConfig?.name || "Data Sheet"}
                  </Text>
                  <Group gap="md">
                    {(isManualEntryMode ? hasManualRows : Object.keys(mappingState).length > 0) && (
                      <Button
                        size="xs"
                        radius="md"
                        onClick={handleSubmit}
                        styles={{
                          root: {
                            backgroundColor: "black",
                            color: "white",
                            border: "none",
                            "&:hover": {
                              backgroundColor: "#333",
                            },
                          },
                        }}
                      >
                        Submit {currentSheetConfig?.name} Data
                      </Button>
                    )}
                    <div
                      style={{
                        display: "flex",
                        backgroundColor: "var(--mantine-color-gray-1)",
                        borderRadius: "6px",
                        padding: "2px",
                        gap: "2px",
                      }}
                    >
                      {[
                        { label: "All", value: "all", count: totalRows },
                        { label: "Valid", value: "valid", count: validRows },
                        {
                          label: "Invalid",
                          value: "invalid",
                          count: invalidRows,
                        },
                      ].map((item) => (
                        <button
                          key={item.value}
                          onClick={() =>
                            setSelectedFilter(
                              item.value as "all" | "valid" | "invalid"
                            )
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: "none",
                            backgroundColor:
                              item.value === selectedFilter
                                ? "white"
                                : "transparent",
                            color: "var(--mantine-color-gray-7)",
                            fontSize: "13px",
                            fontWeight: 500,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow:
                              item.value === selectedFilter
                                ? "0 1px 2px rgba(0, 0, 0, 0.05)"
                                : "none",
                          }}
                          onMouseEnter={(e) => {
                            if (item.value !== selectedFilter) {
                              e.currentTarget.style.backgroundColor =
                                "rgba(255, 255, 255, 0.5)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (item.value !== selectedFilter) {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                            }
                          }}
                        >
                          <span>{item.label}</span>
                          {(item.count > 0 || isCalculatingValidation) && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: "20px",
                                height: "20px",
                                borderRadius: "10px",
                                backgroundColor: "var(--mantine-color-gray-4)",
                                color: "white",
                                fontSize: "11px",
                                fontWeight: 600,
                              }}
                            >
                              {isCalculatingValidation ? (
                                <div
                                  style={{
                                    width: "10px",
                                    height: "10px",
                                    border: "2px solid white",
                                    borderTop: "2px solid transparent",
                                    borderRadius: "50%",
                                    animation: "spin 1s linear infinite",
                                  }}
                                />
                              ) : (
                                item.count
                              )}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                  </Group>
                </Group>

                <Divider my="md" />

                <Box
                  style={{
                    position: "relative",
                    minHeight: "600px",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 1,
                      padding: "16px",
                    }}
                  >
                    <div
                      ref={setTableContainerRef}
                      style={{
                        height: "100%",
                        minHeight: "400px",
                        overflow: "hidden",
                      }}
                    >
                      {currentSheetConfig && (
                        <Table
                          striped={false}
                          highlightOnHover={false}
                          withTableBorder
                          withColumnBorders
                          style={{
                            height: "100%",
                            opacity: isManualEntryMode ? 1 : 0.98,
                            filter: isManualEntryMode ? "none" : "blur(0.5px)",
                            pointerEvents: isManualEntryMode ? "auto" : "none",
                            backgroundColor: "white",
                            borderCollapse: "collapse",
                            tableLayout: "fixed",
                            width: "100%",
                          }}
                        >
                          <Table.Thead>
                            <Table.Tr
                              style={{
                                backgroundColor: "var(--mantine-color-gray-0)",
                              }}
                            >
                              {currentSheetConfig.fields.map((field) => (
                                <Table.Th
                                  key={field.key}
                                  style={{
                                    color: isManualEntryMode
                                      ? "var(--mantine-color-gray-8)"
                                      : "var(--mantine-color-gray-5)",
                                    fontWeight: 500,
                                    fontSize: "12px",
                                    height: "24px",
                                    borderBottom:
                                      "1px solid var(--mantine-color-gray-3)",
                                    borderRight:
                                      "1px solid var(--mantine-color-gray-3)",
                                    backgroundColor:
                                      "var(--mantine-color-gray-0)",
                                    padding: "6px 10px",
                                    width: `${
                                      100 / currentSheetConfig.fields.length
                                    }%`,
                                    minWidth: "120px",
                                    maxWidth: `${
                                      100 / currentSheetConfig.fields.length
                                    }%`,
                                  }}
                                >
                                  {field.label}
                                </Table.Th>
                              ))}
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {(() => {
                              const visibleDataRows = Array.from(
                                { length: maxRows },
                                (_, i) => i
                              ).filter(isRowVisible);
                              const totalRows = [];

                              visibleDataRows.forEach((originalIndex) => {
                                totalRows.push({ type: "data", originalIndex });
                              });

                              const blanksNeeded =
                                maxRows - visibleDataRows.length;
                              for (let i = 0; i < blanksNeeded; i++) {
                                totalRows.push({
                                  type: "blank",
                                  originalIndex: maxRows + i,
                                });
                              }

                              return totalRows.map((row, displayIndex) => (
                                <Table.Tr
                                  key={
                                    row.type === "data"
                                      ? `data-${row.originalIndex}`
                                      : `blank-${row.originalIndex}`
                                  }
                                  style={{ backgroundColor: "white" }}
                                >
                                  {currentSheetConfig.fields.map((field) => {
                                    const isDataRow = row.type === "data";
                                    const rowIndex = isDataRow
                                      ? row.originalIndex
                                      : row.originalIndex;

                                    return (
                                      <Table.Td
                                        key={field.key}
                                        style={{
                                          color: "var(--mantine-color-gray-5)",
                                          fontSize: "12px",
                                          padding: "0",
                                          borderRight:
                                            "1px solid var(--mantine-color-gray-3)",
                                          borderBottom:
                                            displayIndex ===
                                            totalRows.length - 1
                                              ? "2px solid var(--mantine-color-gray-3)"
                                              : "1px solid var(--mantine-color-gray-3)",
                                          backgroundColor: "white",
                                          minHeight: "24px",
                                          width: `${
                                            100 /
                                            currentSheetConfig.fields.length
                                          }%`,
                                          minWidth: "120px",
                                          maxWidth: `${
                                            100 /
                                            currentSheetConfig.fields.length
                                          }%`,
                                          overflow: "hidden",
                                        }}
                                      >
                                        {isManualEntryMode ? (
                                          <input
                                            type={
                                              field.type === "number"
                                                ? "number"
                                                : "text"
                                            }
                                            value={
                                              isDataRow
                                                ? manualEntryData[
                                                    `manual-${row.originalIndex}`
                                                  ]?.[field.key] || ""
                                                : ""
                                            }
                                            onChange={(e) => {
                                              if (isDataRow) {
                                                handleManualEntryChange(
                                                  row.originalIndex,
                                                  field.key,
                                                  e.target.value
                                                );
                                              } else {
                                                handleManualEntryChange(
                                                  rowIndex,
                                                  field.key,
                                                  e.target.value
                                                );
                                              }
                                            }}
                                            style={{
                                              width: "100%",
                                              height: "24px",
                                              minHeight: "24px",
                                              maxHeight: "24px",
                                              border:
                                                isDataRow &&
                                                manualEntryErrors[
                                                  `manual-${row.originalIndex}`
                                                ]?.[field.key]
                                                  ? "1px solid var(--mantine-color-red-5)"
                                                  : "1px solid transparent",
                                              outline: "none",
                                              padding: "6px 10px",
                                              fontSize: "12px",
                                              backgroundColor:
                                                isDataRow &&
                                                manualEntryErrors[
                                                  `manual-${row.originalIndex}`
                                                ]?.[field.key]
                                                  ? "var(--mantine-color-red-0)"
                                                  : "transparent",
                                              color:
                                                "var(--mantine-color-gray-8)",
                                              boxSizing: "border-box",
                                              minWidth: 0,
                                              borderRadius: "0px",
                                              transition:
                                                "border-color 0.1s ease, background-color 0.1s ease",
                                            }}
                                            onFocus={(e) => {
                                              const errorKey = isDataRow
                                                ? `manual-${row.originalIndex}`
                                                : `manual-${rowIndex}`;
                                              if (
                                                !manualEntryErrors[errorKey]?.[
                                                  field.key
                                                ]
                                              ) {
                                                e.target.style.border =
                                                  "1px solid black";
                                                e.target.style.borderRadius =
                                                  "2px";
                                              }
                                            }}
                                            onBlur={(e) => {
                                              const errorKey = isDataRow
                                                ? `manual-${row.originalIndex}`
                                                : `manual-${rowIndex}`;
                                              if (
                                                !manualEntryErrors[errorKey]?.[
                                                  field.key
                                                ]
                                              ) {
                                                e.target.style.border =
                                                  "1px solid transparent";
                                                e.target.style.borderRadius =
                                                  "0px";
                                              }
                                            }}
                                            title={
                                              (isDataRow &&
                                                manualEntryErrors[
                                                  `manual-${row.originalIndex}`
                                                ]?.[field.key]) ||
                                              undefined
                                            }
                                          />
                                        ) : (
                                          <div
                                            style={{
                                              padding: "6px 10px",
                                              height: "24px",
                                              minHeight: "24px",
                                              boxSizing: "border-box",
                                              display: "flex",
                                              alignItems: "center",
                                            }}
                                          ></div>
                                        )}
                                      </Table.Td>
                                    );
                                  })}
                                </Table.Tr>
                              ));
                            })()}
                          </Table.Tbody>
                        </Table>
                      )}
                    </div>
                  </Box>

                  {!isManualEntryMode && (
                    <Flex
                      align="center"
                      justify="center"
                      direction="column"
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 3,
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        backdropFilter: "none",
                      }}
                    >
                      <Stack align="center" gap="sm">
                        <div style={{ textAlign: "center" }}>
                          <Title order={2} size="sm" fw={600} c="gray.8">
                            Drag and drop or upload a file to get started
                          </Title>
                        </div>

                        <Stack gap="md" align="center">
                          <Button
                            size="xs"
                            variant="outline"
                            color="dark"
                            leftSection={<IconUpload size={15} />}
                            loading={isUploading}
                            onClick={triggerFilePicker}
                            styles={{
                              root: {
                                backgroundColor: "white",
                                borderColor: "gray",
                                color: "black",
                                fontSize: "12px",
                                "&:hover": {
                                  backgroundColor:
                                    "var(--mantine-color-gray-0)",
                                },
                              },
                            }}
                          >
                            Upload file
                          </Button>

                          <Button
                            size="xs"
                            variant="outline"
                            color="dark"
                            leftSection={<IconEdit size={15} />}
                            onClick={() => {
                              // Enter manual entry mode and clear any previous import state
                              setIsManualEntryMode(true);
                              clearImportedData();
                              setMapping({});
                            }}
                            styles={{
                              root: {
                                backgroundColor: "white",
                                borderColor: "gray",
                                color: "black",
                                fontSize: "12px",
                                "&:hover": {
                                  backgroundColor:
                                    "var(--mantine-color-gray-0)",
                                },
                              },
                            }}
                          >
                            Manually enter data
                          </Button>
                        </Stack>
                      </Stack>
                    </Flex>
                  )}
                </Box>
              </Card>
            )}
          </Container>
        </div>
      </Providers>
    );
  }
);

export default FilefeedWorkbook;
FilefeedWorkbook.displayName = "FilefeedWorkbook";
