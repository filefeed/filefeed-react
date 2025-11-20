"use client";

import React, { useState, useRef } from "react";
import {
  Card,
  Group,
  Text,
  Select,
  Stack,
  Button,
  Box,
  Flex,
  Paper,
  ThemeIcon,
  ScrollArea,
  Modal,
  List,
  Loader,
} from "@mantine/core";
import { IconArrowRight, IconFileText, IconAlertCircle } from "@tabler/icons-react";
import { MappingInterfaceProps, FieldMapping } from "../types";
import {
  fieldMappingsToMappingState,
  mappingStateToFieldMappings,
} from "../utils/dataProcessing";

const MappingInterface: React.FC<MappingInterfaceProps> = ({
  importedHeaders,
  fields,
  mapping,
  onMappingChange,
  confidenceThreshold = 0.7,
  importedData,
  onBack,
  onContinue,
  onExit,
  fieldMappings,
  onFieldMappingsChange,
  transformRegistry,
  isProcessing,
  canContinue,
}) => {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [draggedSource, setDraggedSource] = useState<string | null>(null);
  const [lastHoveredSource, setLastHoveredSource] = useState<string | null>(null);
  const [missingModalOpen, setMissingModalOpen] = useState(false);

  const handleMappingUpdate = (
    sourceColumn: string,
    targetField: string | null
  ) => {
    // Update legacy mapping state
    const newMapping = { ...mapping, [sourceColumn]: targetField };
    onMappingChange(newMapping);
    // If advanced mapping is used, keep FieldMapping[] in sync
    if (onFieldMappingsChange) {
      const fm: FieldMapping[] = fieldMappings
        ? [...fieldMappings]
        : mappingStateToFieldMappings(newMapping);
      const idx = fm.findIndex((m) => m.source === sourceColumn);
      if (idx >= 0) {
        if (targetField) fm[idx] = { ...fm[idx], target: targetField };
        else fm.splice(idx, 1);
      } else if (targetField) {
        fm.push({ source: sourceColumn, target: targetField });
      }
      onFieldMappingsChange(fm);
    }
  };

  const handleTransformUpdate = (
    sourceColumn: string,
    transformName: string | null
  ) => {
    if (!onFieldMappingsChange) return;
    const current = fieldMappings || mappingStateToFieldMappings(mapping);
    const idx = current.findIndex((m) => m.source === sourceColumn);
    if (idx >= 0) {
      const updated = [...current];
      const t = transformName || undefined;
      updated[idx] = { ...updated[idx], transform: t };
      onFieldMappingsChange(updated);
    }
  };

  const handleDragStart = (e: React.DragEvent, sourceColumn: string) => {
    setDraggedSource(sourceColumn);
    e.dataTransfer.setData("text/plain", sourceColumn);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetField: string) => {
    e.preventDefault();
    const sourceColumn = e.dataTransfer.getData("text/plain");
    if (sourceColumn) {
      handleMappingUpdate(sourceColumn, targetField);
    }
    setDraggedSource(null);
  };

  const handleRemoveMapping = (sourceColumn: string) => {
    handleMappingUpdate(sourceColumn, null);
  };

  const getPreviewData = (sourceColumn: string) => {
    if (!importedData?.rows) return [];
    return importedData.rows
      .slice(0, 5)
      .map((row) => row[sourceColumn])
      .filter((val) => val !== undefined && val !== null && val !== "");
  };

  const incomingFieldsCount = importedHeaders.length;
  const destinationFieldsCount = fields.length;
  const effectiveMapping = fieldMappings
    ? fieldMappingsToMappingState(fieldMappings)
    : mapping;

  const mappedCount = Object.values(effectiveMapping).filter(
    (value) => value !== null
  ).length;
  const unmappedSources = importedHeaders.filter(
    (header) => !effectiveMapping[header]
  );
  const mappedSources = importedHeaders.filter(
    (header) => effectiveMapping[header]
  );
  const usedTargets = Object.values(effectiveMapping).filter(Boolean);
  const availableTargets = fields.filter(
    (field) => !usedTargets.includes(field.key)
  );
  const missingRequired = fields.filter((f) => f.required && !usedTargets.includes(f.key));

  return (
    <Box style={{ padding: "16px", minHeight: "600px" }}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb="md">
        <Group>
          <Text size="lg" fw={600} c="gray.8">
            Column Mapping
          </Text>
          <Text size="sm" c="gray.6">Mapped {mappedCount}/{destinationFieldsCount}</Text>
        </Group>

        <Group gap="xs">
          <Button variant="default" size="xs" onClick={onBack}>
            Back
          </Button>
          {isProcessing && (
            <Group gap="xs">
              <Loader size="xs" color="gray" />
              <Text size="xs" c="gray.6">Processing...</Text>
            </Group>
          )}
          <Button
            size="xs"
            radius="md"
            variant="filled"
            color="dark"
            disabled={isProcessing}
            onClick={() => {
              if (canContinue) onContinue();
              else setMissingModalOpen(true);
            }}
          >
            Continue
          </Button>
        </Group>
      </Flex>

      <Modal
        opened={missingModalOpen}
        onClose={() => setMissingModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="red" variant="light" radius="xl" size="sm">
              <IconAlertCircle size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>Missing required fields</Text>
          </Group>
        }
        centered
        zIndex={10050}
        overlayProps={{ opacity: 0.45, blur: 2 }}
      >
        <Text size="sm" c="gray.7" mb="xs">
          Map these fields to continue.
        </Text>
        <Paper withBorder radius="md" p="xs">
          <ScrollArea style={{ maxHeight: 180 }}>
            <List
              spacing="xs"
              icon={
                <ThemeIcon color="red" variant="light" radius="xl" size="sm">
                  <IconAlertCircle size={12} />
                </ThemeIcon>
              }
            >
              {missingRequired.map((f) => (
                <List.Item key={f.key}>
                  <Text size="sm" c="gray.8">{f.label || f.key}</Text>
                </List.Item>
              ))}
            </List>
          </ScrollArea>
        </Paper>
        <Group justify="flex-end" mt="sm">
          <Button size="xs" color="red" onClick={() => setMissingModalOpen(false)}>
            Got it
          </Button>
        </Group>
      </Modal>

      {/* Main Mapping Interface - Two Column Layout */}
      <Flex gap="md" style={{ minHeight: "500px" }}>
        {/* Left Side - Mapping Fields */}
        <Box style={{ flex: 1 }}>
          <Paper p="md" withBorder radius="md" style={{ height: "500px" }}>
            <Text size="sm" fw={600} c="gray.8" mb="md">
              Field Mappings
            </Text>

            <ScrollArea style={{ height: "440px" }}>
              <Stack gap="xs">
                {importedHeaders.map((header) => {
                  const mappedField = effectiveMapping[header];
                  const targetField = fields.find((f) => f.key === mappedField);
                  const isMapped = !!mappedField;

                  return (
                    <Card
                      key={header}
                      p="sm"
                      radius="md"
                      withBorder
                      style={{
                        backgroundColor:
                          hoveredSource === header
                            ? "var(--mantine-color-gray-0)"
                            : "white",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={() => { setHoveredSource(header); setLastHoveredSource(header); }}
                      onMouseLeave={() => setHoveredSource(null)}
                    >
                      <Flex align="center" style={{ flex: 1 }} gap="md">
                        {/* Left side - Source column (50%) */}
                        <Box style={{ flex: 1 }}>
                          <Text size="sm" fw={500} c="gray.8">
                            {header}
                          </Text>
                        </Box>

                        {/* Middle - Arrow */}
                        <Box>
                          <IconArrowRight size={16} color="gray" />
                        </Box>

                        {/* Right side - Destination field (50%) */}
                        <Box style={{ flex: 1, display: "flex", gap: 8 }}>
                          <Select
                            key={`${header}:${mappedField || 'none'}`}
                            placeholder="Select field"
                            value={mappedField || null}
                            onChange={(value) => {
                              const v = value ?? null;
                              handleMappingUpdate(header, v);
                            }}
                            data={(() => {
                              const currentTarget = mappedField
                                ? fields.find((f) => f.key === mappedField)
                                : undefined;
                              const options = [
                                ...(currentTarget
                                  ? [{ value: currentTarget.key, label: `${currentTarget.label}${currentTarget.required ? " *" : ""}` }]
                                  : []),
                                ...availableTargets.map((f) => ({ value: f.key, label: `${f.label}${f.required ? " *" : ""}` })),
                              ];
                              // de-duplicate by value while preserving order
                              return options.filter((opt, idx, arr) =>
                                arr.findIndex((o) => o.value === opt.value) === idx
                              );
                            })()}
                            searchable={false}
                            clearable
                            size="xs"
                            comboboxProps={{ withinPortal: true, zIndex: 10020 }}
                            styles={{
                              input: {
                                fontSize: "12px",
                                border: isMapped
                                  ? "none"
                                  : "1px solid var(--mantine-color-gray-4)",
                                backgroundColor: "white",
                                cursor: "pointer",
                              },
                            }}
                          />
                          {(() => {
                            const existingTransform = (fieldMappings || []).find(
                              (m) => m.source === header
                            )?.transform;
                            const hasRegistry = !!transformRegistry && Object.keys(transformRegistry || {}).length > 0;
                            return isMapped && (hasRegistry || !!existingTransform);
                          })() && (
                            <Select
                              placeholder="Transform"
                              value={(fieldMappings || []).find((m) => m.source === header)?.transform || null}
                              onChange={(value) => {
                                const v = value === "none" ? null : value;
                                handleTransformUpdate(header, v);
                              }}
                              data={(() => {
                                const keys = Object.keys(transformRegistry || {});
                                return [
                                  { value: "none", label: "None" },
                                  ...keys.map((name) => ({ value: name, label: name })),
                                ];
                              })()}
                              size="xs"
                              clearable
                              comboboxProps={{
                                withinPortal: true,
                                zIndex: 10020,
                              }}
                              styles={{
                                input: {
                                  fontSize: "12px",
                                  backgroundColor: "white",
                                  cursor: "pointer",
                                },
                              }}
                            />
                          )}
                        </Box>
                      </Flex>
                    </Card>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Paper>
        </Box>

        {/* Right Side - Row Preview */}
        <Box style={{ flex: 1 }}>
          <Paper p="md" withBorder radius="md" style={{ height: "500px" }}>
            <Text size="sm" fw={600} c="gray.8" mb="md">
              Data Preview
            </Text>

            <Box style={{ height: "440px", overflow: "auto" }}>
              {(() => { const previewKey = hoveredSource ?? lastHoveredSource; return previewKey; })() ? (
                <Box>
                  <Text size="sm" fw={500} c="gray.7" mb="md">
                    Column: {(hoveredSource ?? lastHoveredSource) as string}
                  </Text>

                  {/* Sample Data */}
                  <Stack gap="xs">
                    <Text size="xs" fw={500} c="gray.6" tt="uppercase">
                      Sample Values:
                    </Text>
                    {getPreviewData((hoveredSource ?? lastHoveredSource) as string)
                      .slice(0, 10)
                      .map((value, index) => (
                        <Box
                          key={index}
                          style={{
                            padding: "8px 12px",
                            backgroundColor: "var(--mantine-color-gray-0)",
                            borderRadius: "4px",
                            border: "1px solid var(--mantine-color-gray-2)",
                          }}
                        >
                          <Text size="sm" c="gray.8">
                            Row {index + 1}: {String(value)}
                          </Text>
                        </Box>
                      ))}

                    {getPreviewData((hoveredSource ?? lastHoveredSource) as string).length === 0 && (
                      <Text
                        size="sm"
                        c="gray.5"
                        style={{ fontStyle: "italic" }}
                      >
                        No data available for this column
                      </Text>
                    )}

                    {getPreviewData((hoveredSource ?? lastHoveredSource) as string).length > 10 && (
                      <Text
                        size="xs"
                        c="gray.5"
                        style={{ fontStyle: "italic" }}
                      >
                        ... and {getPreviewData((hoveredSource ?? lastHoveredSource) as string).length - 10} more
                        rows
                      </Text>
                    )}
                  </Stack>
                </Box>
              ) : (
                <Flex
                  align="center"
                  justify="center"
                  style={{ height: "100%" }}
                  direction="column"
                  gap="md"
                >
                  <ThemeIcon variant="light" color="gray" size="xl">
                    <IconFileText size={24} />
                  </ThemeIcon>
                  <Text size="sm" c="gray.5" ta="center">
                    Hover over a field mapping on the left
                    <br />
                    to see data preview
                  </Text>
                </Flex>
              )}
            </Box>
          </Paper>
        </Box>
      </Flex>
    </Box>
  );
};

export default MappingInterface;
