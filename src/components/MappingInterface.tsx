"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Group,
  Text,
  Select,
  Stack,
  Button,
  Box,
  Loader,
  Popover,
  UnstyledButton,
  Tooltip,
} from "@mantine/core";
import { IconWand, IconCheck } from "@tabler/icons-react";
import { MappingInterfaceProps, FieldMapping, FieldConfig } from "../types";
import { Z_INDEX } from "../constants";
import {
  fieldMappingsToMappingState,
  mappingStateToFieldMappings,
  transformLabel,
  transformExample,
  collectHeaderSamples,
  getUnmappedRequiredFields,
} from "../utils/dataProcessing";
import { headerLooksLikeCode, isExactHeaderMatch } from "../utils/mappingDisplay";

// FileFeed palette. Fonts come from the host's Mantine theme.
const C = {
  ink: "#021526",
  slate: "#404D59",
  muted: "#667480",
  blue: "#0D40FF",
  bg: "#F2F5F7",
  border: "rgba(15,23,42,0.08)",
} as const;

const ROW_HEIGHT = 44;
const TABLE_MAX_HEIGHT = 520;
const MOBILE_BREAKPOINT = 639;
const SAMPLE_COUNT = 3;
const SAMPLE_MAX_LEN = 40;
const TRANSFORM_COL_ICON = 48;
const TRANSFORM_COL_LABEL = 176;

const selectComboboxProps = {
  withinPortal: true,
  zIndex: Z_INDEX.SELECT_COMBOBOX,
} as const;

type Origin = "ai" | "exact" | "fuzzy" | null;
type TargetOption = { value: string; label: string };

// ─────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────

/** True below 640px. SSR-safe: starts as desktop, corrects after mount. */
function useIsNarrow(maxWidth: number = MOBILE_BREAKPOINT): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [maxWidth]);
  return narrow;
}

const joinLabels = (fields: FieldConfig[]): string =>
  fields.map((f) => f.label || f.key).join(", ");

// ─────────────────────────────────────────────────────────────────────
// Presentational bits
// ─────────────────────────────────────────────────────────────────────

const ORIGIN_HINT: Record<Exclude<Origin, null>, string> = {
  ai: "Matched by AI",
  exact: "Header matches the field name",
  fuzzy: "Similar header name, please check",
};

function OriginDot({ origin }: { origin: Origin }) {
  if (!origin) return <span aria-hidden="true" style={{ display: "inline-block", width: 4, height: 4 }} />;
  const solid = origin === "ai" || origin === "exact";
  return (
    <Tooltip label={ORIGIN_HINT[origin]} withinPortal zIndex={Z_INDEX.SELECT_COMBOBOX} openDelay={300}>
      <span
        role="img"
        aria-label={ORIGIN_HINT[origin]}
        style={{
          display: "inline-block",
          width: 4,
          height: 4,
          borderRadius: "50%",
          boxSizing: "border-box",
          backgroundColor: solid ? C.blue : "transparent",
          border: `1px solid ${C.blue}`,
        }}
      />
    </Tooltip>
  );
}

function RequiredTag({ style }: { style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10.5,
        lineHeight: "16px",
        fontWeight: 500,
        letterSpacing: "0.02em",
        color: C.muted,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: "0 6px",
        backgroundColor: "#ffffff",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      required
    </span>
  );
}

interface TargetSelectProps {
  header: string;
  value: string | null;
  options: TargetOption[];
  fieldByKey: Map<string, FieldConfig>;
  usedBy: Map<string, string>;
  origin: Origin;
  onChange: (value: string | null) => void;
}

function TargetSelect({ header, value, options, fieldByKey, usedBy, origin, onChange }: TargetSelectProps) {
  const isMapped = !!value;
  const selectedRequired = isMapped && !!fieldByKey.get(value)?.required;

  const renderOption = useCallback(
    ({ option, checked }: { option: TargetOption; checked?: boolean }) => {
      const field = fieldByKey.get(option.value);
      const owner = usedBy.get(option.value);
      const elsewhere = owner && owner !== header ? owner : null;
      return (
        <Group gap={8} wrap="nowrap" justify="space-between" style={{ width: "100%", minWidth: 0 }}>
          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
            {checked ? (
              <IconCheck size={14} style={{ color: C.ink, flex: "0 0 auto" }} aria-hidden="true" />
            ) : null}
            <Text size="sm" c={C.ink} truncate style={{ minWidth: 0 }}>
              {option.label}
            </Text>
            {elsewhere ? (
              <Text size="xs" c={C.muted} truncate style={{ minWidth: 0 }}>
                now on {elsewhere}
              </Text>
            ) : null}
          </Group>
          {field?.required ? <RequiredTag /> : null}
        </Group>
      );
    },
    [fieldByKey, usedBy, header]
  );

  return (
    <Box style={{ position: "relative", width: "100%", minWidth: 0 }}>
      <Select
        aria-label={`Maps ${header} to`}
        placeholder="Leave unmapped"
        value={value}
        onChange={(v) => onChange(v ?? null)}
        data={options}
        searchable
        clearable
        clearButtonProps={{ "aria-label": `Clear mapping for ${header}` }}
        nothingFoundMessage="No field with that name"
        size="sm"
        radius={6}
        comboboxProps={selectComboboxProps}
        leftSection={<OriginDot origin={origin} />}
        leftSectionWidth={18}
        leftSectionPointerEvents={origin ? "auto" : "none"}
        renderOption={renderOption}
        styles={{
          input: {
            height: 36,
            minHeight: 36,
            borderColor: C.border,
            color: isMapped ? C.ink : C.muted,
            paddingRight: selectedRequired ? 104 : undefined,
          },
          section: { color: C.muted },
        }}
      />
      {selectedRequired ? (
        <RequiredTag
          style={{ position: "absolute", right: 34, top: 10, pointerEvents: "none" }}
        />
      ) : null}
    </Box>
  );
}

interface TransformPickerProps {
  header: string;
  current: string | undefined;
  transformKeys: string[];
  variant: "icon" | "link";
  onChange: (transform: string | null) => void;
}

function TransformPicker({ header, current, transformKeys, variant, onChange }: TransformPickerProps) {
  const [opened, setOpened] = useState(false);
  const label = current ? transformLabel(current) : null;

  const pick = (key: string | null) => {
    onChange(key);
    setOpened(false);
  };

  const target =
    variant === "icon" ? (
      <UnstyledButton
        aria-label={label ? `Transform for ${header}: ${label}` : `Add a transform for ${header}`}
        aria-haspopup="listbox"
        aria-expanded={opened}
        title={label ?? "Add a transform"}
        onClick={() => setOpened((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 28,
          maxWidth: "100%",
          padding: label ? "0 8px 0 6px" : "0 6px",
          borderRadius: 6,
          color: label ? C.ink : C.muted,
          backgroundColor: opened ? C.bg : "transparent",
        }}
      >
        <IconWand size={15} aria-hidden="true" style={{ flex: "0 0 auto" }} />
        {label ? (
          <Text size="xs" c={C.ink} truncate style={{ minWidth: 0 }}>
            {label}
          </Text>
        ) : null}
      </UnstyledButton>
    ) : (
      <UnstyledButton
        aria-haspopup="listbox"
        aria-expanded={opened}
        onClick={() => setOpened((o) => !o)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <IconWand size={14} aria-hidden="true" style={{ color: C.muted }} />
        <Text size="xs" c={label ? C.ink : C.muted} style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
          {label ? `Transform: ${label}` : "Add a transform"}
        </Text>
      </UnstyledButton>
    );

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      withinPortal
      zIndex={Z_INDEX.SELECT_COMBOBOX}
      shadow="md"
      radius={8}
      width={280}
      trapFocus
      returnFocus
    >
      <Popover.Target>{target}</Popover.Target>
      <Popover.Dropdown p={4} style={{ border: `1px solid ${C.border}` }}>
        <Box role="listbox" aria-label={`Transform for ${header}`}>
          <TransformOption
            label="No transform"
            selected={!current}
            onClick={() => pick(null)}
          />
          {transformKeys.map((key) => (
            <TransformOption
              key={key}
              label={transformLabel(key)}
              example={transformExample(key)}
              selected={current === key}
              onClick={() => pick(key)}
            />
          ))}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}

function TransformOption({
  label,
  example,
  selected,
  onClick,
}: {
  label: string;
  example?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <UnstyledButton
      role="option"
      aria-selected={selected}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        width: "100%",
        padding: "7px 10px",
        borderRadius: 6,
        backgroundColor: selected || hover ? C.bg : "transparent",
      }}
    >
      <Group gap={8} wrap="nowrap" justify="space-between">
        <Box style={{ minWidth: 0 }}>
          <Text size="sm" c={C.ink} fw={selected ? 600 : 400}>
            {label}
          </Text>
          {example ? (
            <Text size="xs" c={C.muted} ff="monospace" mt={2} truncate>
              {example}
            </Text>
          ) : null}
        </Box>
        {selected ? <IconCheck size={14} style={{ color: C.ink, flex: "0 0 auto" }} aria-hidden="true" /> : null}
      </Group>
    </UnstyledButton>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────

interface RowData {
  header: string;
  target: string | null;
  samples: string;
  origin: Origin;
  transform: string | undefined;
  showTransform: boolean;
  options: TargetOption[];
}

interface RowProps {
  row: RowData;
  isLast: boolean;
  fieldByKey: Map<string, FieldConfig>;
  usedBy: Map<string, string>;
  transformKeys: string[];
  onMappingUpdate: (source: string, target: string | null) => void;
  onTransformUpdate: (source: string, transform: string | null) => void;
}

const cellStyle = (isLast: boolean): React.CSSProperties => ({
  height: ROW_HEIGHT,
  padding: "0 12px",
  verticalAlign: "middle",
  borderBottom: isLast ? "none" : `1px solid ${C.border}`,
  boxSizing: "border-box",
});

const TableRow = React.memo(function TableRow({
  row,
  isLast,
  fieldByKey,
  usedBy,
  transformKeys,
  onMappingUpdate,
  onTransformUpdate,
}: RowProps) {
  const textColor = row.target ? C.ink : C.muted;
  const cs = cellStyle(isLast);
  return (
    <tr data-ff-mapping-row={row.header} data-ff-mapped={row.target ? "true" : "false"}>
      <td style={cs}>
        <Text
          size="sm"
          fw={500}
          c={textColor}
          truncate
          title={row.header}
          ff={headerLooksLikeCode(row.header) ? "monospace" : undefined}
        >
          {row.header}
        </Text>
      </td>
      <td style={cs}>
        <Text size="sm" c={C.muted} truncate title={row.samples || undefined}>
          {row.samples || "No values"}
        </Text>
      </td>
      <td style={{ ...cs, padding: "0 8px 0 12px" }}>
        <TargetSelect
          header={row.header}
          value={row.target}
          options={row.options}
          fieldByKey={fieldByKey}
          usedBy={usedBy}
          origin={row.origin}
          onChange={(v) => onMappingUpdate(row.header, v)}
        />
      </td>
      <td style={{ ...cs, padding: "0 8px", textAlign: "right" }}>
        {row.showTransform ? (
          <TransformPicker
            header={row.header}
            current={row.transform}
            transformKeys={transformKeys}
            variant="icon"
            onChange={(t) => onTransformUpdate(row.header, t)}
          />
        ) : null}
      </td>
    </tr>
  );
});

const CardRow = React.memo(function CardRow({
  row,
  fieldByKey,
  usedBy,
  transformKeys,
  onMappingUpdate,
  onTransformUpdate,
}: Omit<RowProps, "isLast">) {
  const textColor = row.target ? C.ink : C.muted;
  return (
    <Box
      data-ff-mapping-row={row.header}
      data-ff-mapped={row.target ? "true" : "false"}
      style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}
    >
      <Text
        size="sm"
        fw={500}
        c={textColor}
        truncate
        title={row.header}
        ff={headerLooksLikeCode(row.header) ? "monospace" : undefined}
      >
        {row.header}
      </Text>
      <Text size="xs" c={C.muted} truncate mt={2} title={row.samples || undefined}>
        {row.samples || "No values"}
      </Text>
      <Box mt={8}>
        <TargetSelect
          header={row.header}
          value={row.target}
          options={row.options}
          fieldByKey={fieldByKey}
          usedBy={usedBy}
          origin={row.origin}
          onChange={(v) => onMappingUpdate(row.header, v)}
        />
      </Box>
      {row.showTransform ? (
        <Box mt={8}>
          <TransformPicker
            header={row.header}
            current={row.transform}
            transformKeys={transformKeys}
            variant="link"
            onChange={(t) => onTransformUpdate(row.header, t)}
          />
        </Box>
      ) : null}
    </Box>
  );
});

// ─────────────────────────────────────────────────────────────────────
// Mapping step
// ─────────────────────────────────────────────────────────────────────

const MappingInterface: React.FC<MappingInterfaceProps> = ({
  importedHeaders,
  fields,
  mapping,
  onMappingChange,
  importedData,
  onBack,
  onContinue,
  fieldMappings,
  onFieldMappingsChange,
  transformRegistry,
  isProcessing,
  canContinue,
  aiMappingPending = false,
  allowUnmappedRequired = false,
  aiMappedSources,
}) => {
  const isNarrow = useIsNarrow();
  const [showOptional, setShowOptional] = useState(false);

  // Columns the user changed by hand lose their confidence dot. Reset on a
  // new file (headers change) so the next import starts clean.
  const userEditedRef = useRef<Set<string>>(new Set());
  const headersKey = importedHeaders.join("\u0000");
  useEffect(() => {
    userEditedRef.current = new Set();
  }, [headersKey]);
  const [, bump] = useState(0);

  const effectiveMapping = useMemo(
    () => (fieldMappings ? fieldMappingsToMappingState(fieldMappings) : mapping),
    [fieldMappings, mapping]
  );

  const handleMappingUpdate = useCallback(
    (sourceColumn: string, targetField: string | null) => {
      userEditedRef.current.add(sourceColumn);
      bump((n) => n + 1);

      // One target per column: taking a target from another column frees it.
      const newMapping: Record<string, string | null> = { ...mapping };
      if (targetField) {
        for (const [src, tgt] of Object.entries(newMapping)) {
          if (src !== sourceColumn && tgt === targetField) newMapping[src] = null;
        }
      }
      newMapping[sourceColumn] = targetField;
      onMappingChange(newMapping);

      if (onFieldMappingsChange) {
        const base: FieldMapping[] = fieldMappings
          ? [...fieldMappings]
          : mappingStateToFieldMappings(newMapping);
        let fm = targetField
          ? base.filter((m) => m.source === sourceColumn || m.target !== targetField)
          : base;
        const idx = fm.findIndex((m) => m.source === sourceColumn);
        if (idx >= 0) {
          if (targetField) fm[idx] = { ...fm[idx], target: targetField };
          else fm = fm.filter((_, i) => i !== idx);
        } else if (targetField) {
          fm.push({ source: sourceColumn, target: targetField });
        }
        onFieldMappingsChange(fm);
      }
    },
    [mapping, onMappingChange, fieldMappings, onFieldMappingsChange]
  );

  const handleTransformUpdate = useCallback(
    (sourceColumn: string, transformName: string | null) => {
      if (!onFieldMappingsChange) return;
      const current = fieldMappings || mappingStateToFieldMappings(mapping);
      const idx = current.findIndex((m) => m.source === sourceColumn);
      if (idx < 0) return;
      const updated = [...current];
      updated[idx] = { ...updated[idx], transform: transformName || undefined };
      onFieldMappingsChange(updated);
    },
    [fieldMappings, mapping, onFieldMappingsChange]
  );

  const fieldByKey = useMemo(() => {
    const m = new Map<string, FieldConfig>();
    for (const f of fields) m.set(f.key, f);
    return m;
  }, [fields]);

  // target key -> source column currently feeding it
  const usedBy = useMemo(() => {
    const m = new Map<string, string>();
    for (const [src, tgt] of Object.entries(effectiveMapping)) if (tgt) m.set(tgt, src);
    return m;
  }, [effectiveMapping]);

  const currentFieldMappings = useMemo(
    () => fieldMappings ?? mappingStateToFieldMappings(effectiveMapping),
    [fieldMappings, effectiveMapping]
  );

  const { mappedTargets, missingRequired, unmappedOptional } = useMemo(() => {
    const mappedKeys = new Set(usedBy.keys());
    return {
      mappedTargets: fields.filter((f) => mappedKeys.has(f.key)).length,
      missingRequired: getUnmappedRequiredFields(fields, currentFieldMappings),
      unmappedOptional: fields.filter((f) => !f.required && !mappedKeys.has(f.key)),
    };
  }, [fields, usedBy, currentFieldMappings]);

  const allOptions = useMemo<TargetOption[]>(
    () => fields.map((f) => ({ value: f.key, label: f.label || f.key })),
    [fields]
  );

  const samplesByHeader = useMemo(() => {
    const raw = collectHeaderSamples(importedHeaders, importedData?.rows ?? [], SAMPLE_COUNT, SAMPLE_MAX_LEN);
    const out: Record<string, string> = {};
    for (const h of importedHeaders) out[h] = (raw[h] || []).join("  ·  ");
    return out;
  }, [importedHeaders, importedData?.rows]);

  const transformKeys = useMemo(() => Object.keys(transformRegistry || {}), [transformRegistry]);
  const hasRegistry = transformKeys.length > 0;
  const aiSet = useMemo(() => new Set(aiMappedSources || []), [aiMappedSources]);

  const rows = useMemo<RowData[]>(() => {
    return importedHeaders.map((header) => {
      const target = effectiveMapping[header] || null;
      const fm = currentFieldMappings.find((m) => m.source === header);
      const transform = fm?.transform;
      let origin: Origin = null;
      if (target && !userEditedRef.current.has(header)) {
        const field = fieldByKey.get(target);
        if (aiSet.has(header)) origin = "ai";
        else if (field && isExactHeaderMatch(header, field)) origin = "exact";
        else origin = "fuzzy";
      }
      return {
        header,
        target,
        samples: samplesByHeader[header] || "",
        origin,
        transform,
        showTransform: !!target && (hasRegistry || !!transform),
        options: allOptions,
      };
    });
    // userEditedRef is read here on purpose; `bump` re-renders after edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importedHeaders, effectiveMapping, currentFieldMappings, fieldByKey, aiSet, samplesByHeader, hasRegistry, allOptions, userEditedRef.current.size]);

  const anyTransformLabel = rows.some((r) => r.showTransform && r.transform);
  const transformColWidth = anyTransformLabel ? TRANSFORM_COL_LABEL : TRANSFORM_COL_ICON;

  const continueAllowed = canContinue !== false;
  const progress = fields.length > 0 ? Math.round((mappedTargets / fields.length) * 100) : 0;

  const optionalToggle =
    unmappedOptional.length > 0 ? (
      <Box>
        <UnstyledButton
          onClick={() => setShowOptional((v) => !v)}
          aria-expanded={showOptional}
          aria-controls="ff-unmapped-optional"
        >
          <Text size="sm" c={C.muted} style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
            {showOptional ? "Hide" : "Show"} {unmappedOptional.length} unmapped {unmappedOptional.length === 1 ? "field" : "fields"}
          </Text>
        </UnstyledButton>
        {showOptional ? (
          <Text id="ff-unmapped-optional" size="sm" c={C.muted} mt={4}>
            Optional, not mapped: {joinLabels(unmappedOptional)}.
          </Text>
        ) : null}
      </Box>
    ) : null;

  return (
    <Box style={{ padding: 16 }} data-ff-part="mapping-step">
      {/* Top bar */}
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Box style={{ minWidth: 180 }}>
          <Text size="sm" c={C.slate} data-ff-part="mapping-progress">
            Mapped {mappedTargets} of {fields.length} {fields.length === 1 ? "field" : "fields"}
          </Text>
          <Box
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={fields.length}
            aria-valuenow={mappedTargets}
            aria-label="Fields mapped"
            style={{ marginTop: 6, height: 2, borderRadius: 1, backgroundColor: C.border, overflow: "hidden" }}
          >
            <Box style={{ width: `${progress}%`, height: "100%", backgroundColor: C.ink, transition: "width 0.2s ease" }} />
          </Box>
        </Box>

        <Group gap="xs">
          <Button variant="default" size="xs" radius={6} onClick={onBack} styles={{ root: { borderColor: C.border, color: C.ink } }}>
            Back
          </Button>
          {isProcessing ? (
            <Group gap={6}>
              <Loader size="xs" color="gray" />
              <Text size="xs" c={C.muted}>Processing...</Text>
            </Group>
          ) : null}
          <Button
            size="xs"
            radius={6}
            variant="filled"
            disabled={isProcessing || aiMappingPending || !continueAllowed}
            data-ff-ai-pending={aiMappingPending || undefined}
            onClick={() => {
              if (continueAllowed) onContinue?.();
            }}
            styles={{ root: { backgroundColor: C.ink, color: "#ffffff" } }}
          >
            {aiMappingPending ? "Matching columns..." : "Continue"}
          </Button>
        </Group>
      </Group>

      {/* Required fields the file does not have */}
      {missingRequired.length > 0 ? (
        <Box
          role="status"
          data-ff-part="missing-required"
          mt={12}
          style={{ backgroundColor: C.bg, borderRadius: 8, padding: "10px 12px" }}
        >
          <Text size="sm" c={C.ink}>
            <span style={{ fontWeight: 600 }}>Not in your file:</span> {joinLabels(missingRequired)}.
          </Text>
          <Text size="sm" c={C.slate} mt={2}>
            {allowUnmappedRequired
              ? "You can continue. Rows will be flagged where these are missing."
              : "Map these fields to continue."}
          </Text>
          {optionalToggle ? <Box mt={6}>{optionalToggle}</Box> : null}
        </Box>
      ) : optionalToggle ? (
        <Box mt={12}>{optionalToggle}</Box>
      ) : null}

      {/* Mapping table (desktop) or stacked cards (mobile) */}
      {isNarrow ? (
        <Stack gap={8} mt={12} data-ff-part="mapping-cards">
          {rows.map((row) => (
            <CardRow
              key={row.header}
              row={row}
              fieldByKey={fieldByKey}
              usedBy={usedBy}
              transformKeys={transformKeys}
              onMappingUpdate={handleMappingUpdate}
              onTransformUpdate={handleTransformUpdate}
            />
          ))}
        </Stack>
      ) : (
        <Box
          mt={12}
          data-ff-part="mapping-table"
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", backgroundColor: "#ffffff" }}
        >
          <Box style={{ maxHeight: TABLE_MAX_HEIGHT, overflow: "auto" }}>
            <table
              aria-label="Column mapping"
              style={{ width: "100%", minWidth: 720, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}
            >
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "32%" }} />
                <col />
                <col style={{ width: transformColWidth }} />
              </colgroup>
              <thead>
                <tr>
                  {["Column in your file", "Sample values", "Maps to", ""].map((label, i) => (
                    <th
                      key={i}
                      scope="col"
                      aria-label={i === 3 ? "Transform" : undefined}
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        height: 40,
                        padding: "0 12px",
                        textAlign: "left",
                        backgroundColor: "#ffffff",
                        borderBottom: `1px solid ${C.border}`,
                        boxSizing: "border-box",
                      }}
                    >
                      <Text size="xs" fw={500} c={C.muted}>
                        {label}
                      </Text>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <TableRow
                    key={row.header}
                    row={row}
                    isLast={i === rows.length - 1}
                    fieldByKey={fieldByKey}
                    usedBy={usedBy}
                    transformKeys={transformKeys}
                    onMappingUpdate={handleMappingUpdate}
                    onTransformUpdate={handleTransformUpdate}
                  />
                ))}
              </tbody>
            </table>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MappingInterface;
