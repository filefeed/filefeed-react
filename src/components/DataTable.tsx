"use client";

import React, { useState } from "react";
import {
  Table,
  ScrollArea,
  TextInput,
  NumberInput,
  Checkbox,
  ActionIcon,
  Group,
  Text,
  Badge,
  Tooltip,
  Button,
  Stack,
  Alert,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  IconTrash,
  IconPlus,
  IconAlertTriangle,
  IconCheck,
} from "@tabler/icons-react";
import { DataTableProps, DataRow, FieldConfig } from "../types";
import { transformValue } from "../utils/dataProcessing";

const DataTable: React.FC<DataTableProps> = ({
  data,
  fields,
  onDataChange,
  editable = true,
}) => {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    fieldKey: string;
  } | null>(null);

  const handleCellEdit = (rowId: string, fieldKey: string, value: any) => {
    const field = fields.find((f) => f.key === fieldKey);
    if (!field) return;

    const transformedValue = transformValue(value, field.type);

    const updatedData = data.map((row) => {
      if (row.id === rowId) {
        return {
          ...row,
          data: { ...row.data, [fieldKey]: transformedValue },
        };
      }
      return row;
    });

    onDataChange(updatedData);
    setEditingCell(null);
  };

  const handleDeleteRow = (rowId: string) => {
    const updatedData = data.filter((row) => row.id !== rowId);
    onDataChange(updatedData);
  };

  const handleAddRow = () => {
    const newRow: DataRow = {
      id: `row-${Date.now()}`,
      data: {},
      errors: [],
      isValid: false,
    };
    onDataChange([...data, newRow]);
  };

  const renderCell = (row: DataRow, field: FieldConfig) => {
    const value = row.data[field.key];
    const isEditing =
      editingCell?.rowId === row.id && editingCell?.fieldKey === field.key;
    const hasError = row.errors.some((error) => error.field === field.key);

    if (!editable || !isEditing) {
      return (
        <div
          className={`p-2 min-h-[40px] flex items-center cursor-pointer hover:bg-gray-50 ${
            hasError ? "bg-red-50 border-l-2 border-red-400" : ""
          }`}
          onClick={() =>
            editable && setEditingCell({ rowId: row.id, fieldKey: field.key })
          }
        >
          {renderDisplayValue(value, field)}
          {hasError && (
            <Tooltip
              label={row.errors.find((e) => e.field === field.key)?.message}
              position="top"
            >
              <IconAlertTriangle size={16} className="ml-2 text-red-500" />
            </Tooltip>
          )}
        </div>
      );
    }

    return renderEditableCell(row, field, value, handleCellEdit);
  };

  const renderDisplayValue = (value: any, field: FieldConfig) => {
    if (value === null || value === undefined || value === "") {
      return (
        <Text c="dimmed" size="sm">
          Empty
        </Text>
      );
    }

    switch (field.type) {
      case "boolean":
        return value ? (
          <IconCheck size={16} className="text-green-500" />
        ) : (
          <Text c="dimmed">False</Text>
        );
      case "date":
        return <Text size="sm">{new Date(value).toLocaleDateString()}</Text>;
      default:
        return <Text size="sm">{String(value)}</Text>;
    }
  };

  const renderEditableCell = (
    row: DataRow,
    field: FieldConfig,
    value: any,
    onSave: (rowId: string, fieldKey: string, value: any) => void
  ) => {
    const commonProps = {
      size: "sm" as const,
      onBlur: () => setEditingCell(null),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          setEditingCell(null);
        }
        if (e.key === "Escape") {
          setEditingCell(null);
        }
      },
      autoFocus: true,
    };

    switch (field.type) {
      case "number":
        return (
          <NumberInput
            {...commonProps}
            value={value || ""}
            onChange={(val) => onSave(row.id, field.key, val)}
            placeholder={field.label}
          />
        );
      case "boolean":
        return (
          <Checkbox
            {...commonProps}
            checked={Boolean(value)}
            onChange={(e) => onSave(row.id, field.key, e.currentTarget.checked)}
            label=""
          />
        );
      case "date":
        return (
          <DateInput
            {...commonProps}
            value={value ? new Date(value) : null}
            onChange={(date) => onSave(row.id, field.key, date?.toISOString())}
            placeholder={field.label}
          />
        );
      case "email":
        return (
          <TextInput
            {...commonProps}
            type="email"
            value={value || ""}
            onChange={(e) => onSave(row.id, field.key, e.currentTarget.value)}
            placeholder={field.label}
          />
        );
      default:
        return (
          <TextInput
            {...commonProps}
            value={value || ""}
            onChange={(e) => onSave(row.id, field.key, e.currentTarget.value)}
            placeholder={field.label}
          />
        );
    }
  };

  const validRows = data.filter((row) => row.isValid).length;
  const totalRows = data.length;
  const errorCount = data.reduce(
    (acc, row) => acc + row.errors.filter((e) => e.severity === "error").length,
    0
  );

  return (
    <Stack gap="md">
      {/* Summary */}
      <Group justify="space-between">
        <Group gap="md">
          <Badge color="blue" variant="light">
            {totalRows} rows
          </Badge>
          <Badge color="green" variant="light">
            {validRows} valid
          </Badge>
          {errorCount > 0 && (
            <Badge color="red" variant="light">
              {errorCount} errors
            </Badge>
          )}
        </Group>
        {editable && (
          <Button
            leftSection={<IconPlus size={16} />}
            variant="light"
            size="sm"
            onClick={handleAddRow}
          >
            Add Row
          </Button>
        )}
      </Group>

      {/* Data Table */}
      <ScrollArea>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              {fields.map((field) => (
                <Table.Th key={field.key} className="min-w-[150px]">
                  <Group gap="xs">
                    <Text fw={600} size="sm">
                      {field.label}
                    </Text>
                    {field.required && (
                      <Text c="red" size="xs">
                        *
                      </Text>
                    )}
                    <Badge
                      size="xs"
                      variant="dot"
                      color={getFieldTypeColor(field.type)}
                    >
                      {field.type}
                    </Badge>
                  </Group>
                  {field.description && (
                    <Text c="dimmed" size="xs" mt={2}>
                      {field.description}
                    </Text>
                  )}
                </Table.Th>
              ))}
              {editable && <Table.Th style={{ width: 60 }}>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((row) => (
              <Table.Tr
                key={row.id}
                className={
                  row.errors.some((e) => e.severity === "error")
                    ? "bg-red-50"
                    : ""
                }
              >
                {fields.map((field) => (
                  <Table.Td key={field.key} className="p-0">
                    {renderCell(row, field)}
                  </Table.Td>
                ))}
                {editable && (
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => handleDeleteRow(row.id)}
                      size="sm"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* Error Summary */}
      {errorCount > 0 && (
        <Alert
          color="red"
          title="Validation Errors"
          icon={<IconAlertTriangle size="1rem" />}
        >
          <Text size="sm">
            There are {errorCount} validation errors that need to be fixed
            before proceeding.
          </Text>
        </Alert>
      )}

      {data.length === 0 && (
        <Alert color="blue" title="No Data" variant="light">
          <Text size="sm">
            {editable
              ? "No data to display. Import a file or add rows manually to get started."
              : "No data available to display."}
          </Text>
        </Alert>
      )}
    </Stack>
  );
};

const getFieldTypeColor = (type: string): string => {
  switch (type) {
    case "string":
      return "blue";
    case "number":
      return "green";
    case "email":
      return "orange";
    case "date":
      return "purple";
    case "boolean":
      return "teal";
    default:
      return "gray";
  }
};

export default DataTable;
