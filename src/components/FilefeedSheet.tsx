import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFilefeed } from "../hooks/useFilefeed";
import type { Filefeed } from "../types/filefeedTypes";
import { ActionIcon, Modal, Group, Button, Text } from "@mantine/core";
import { Providers } from "../app/providers";

// Use existing primitives from this package
import FilefeedWorkbook from "./FilefeedWorkbook";
import type { CreateWorkbookConfig, ProcessingOptions, DataRow, FilefeedWorkbookRef } from "../types";

type Props = {
  config: Filefeed.SheetConfig;
  onSubmit?: (sheet: { rows: any[]; slug: string }) => Promise<void> | void;
  onRecordHook?: (record: Filefeed.RecordAPI) => Filefeed.RecordAPI | void;
  autoCloseOnComplete?: boolean;
  processing?: ProcessingOptions;
  importOptions?: ProcessingOptions; // alias for processing
};

function mapField(f: Filefeed.Field) {
  return { ...f };
}

function makeRecordAPI(row: Record<string, any>): Filefeed.RecordAPI {
  const data = { ...row };
  return {
    get: (k) => data[k],
    set: (k, v) => {
      data[k] = v;
    },
    toObject: () => ({ ...data }),
  };
}

function applyRecordHook(rows: any[], hook?: (r: Filefeed.RecordAPI) => Filefeed.RecordAPI | void) {
  if (!hook) return rows;
  return rows.map((row) => {
    const rec = makeRecordAPI(row);
    const out = hook(rec);
    if (out) {
      return out.toObject();
    }
    return rec.toObject();
  });
}

export function FilefeedSheet({ config, onSubmit, onRecordHook, autoCloseOnComplete = true, processing, importOptions }: Props) {
  const { open, portalContainer, closePortal } = useFilefeed();
  const wbRef = useRef<FilefeedWorkbookRef | null>(null);

  const wbConfig: CreateWorkbookConfig = {
    name: config.name,
    sheets: [
      {
        name: config.name,
        slug: config.slug,
        fields: config.fields.map(mapField) as any,
      },
    ],
    processing: processing ?? importOptions,
  };

  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Inner UI to render inside the portal when open
  const inner = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}
    >
      <Providers>
        <div style={{ position: "relative", width: "90%", maxWidth: 1200, background: "#fff", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", overflow: "hidden" }}>
          <ActionIcon
            aria-label="Close importer"
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            variant="default"
            size="sm"
            style={{ position: "absolute", top: 8, right: 8, zIndex: 10005 }}
          >
            ✕
          </ActionIcon>
          <FilefeedWorkbook
            ref={wbRef}
            config={wbConfig}
            events={{
              // Default single-shot submit path
              onWorkbookComplete: (rows: any[]) => {
                const normalized = Array.isArray(rows)
                  ? rows.map((r) => (r && typeof r === "object" && "data" in r ? (r as any).data : r))
                  : [];
                const transformed = applyRecordHook(normalized, onRecordHook);
                onSubmit?.({ rows: transformed, slug: config.slug });
                if (autoCloseOnComplete) {
                  closePortal();
                }
              },
              // Chunked submit path (optional)
              onSubmitStart: () => {},
              onSubmitChunk: async ({ rows }: { rows: DataRow[]; chunkIndex: number; totalChunks: number }) => {
                const normalized = Array.isArray(rows)
                  ? rows.map((r) => (r && typeof r === "object" && "data" in r ? (r as any).data : r))
                  : [];
                const transformed = applyRecordHook(normalized, onRecordHook);
                await onSubmit?.({ rows: transformed, slug: config.slug });
              },
              onSubmitComplete: () => {
                if (autoCloseOnComplete) {
                  closePortal();
                }
              },
              onReset: () => {},
            }}
          />
          <Modal
            opened={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title="Close importer?"
            centered
            zIndex={10010}
            overlayProps={{ opacity: 0.45, blur: 2 }}
          >
            <Text size="sm" c="gray.7" mb="md">
              Are you sure you want to close the importer? Unsaved changes will be lost.
            </Text>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={(e) => { e.stopPropagation(); setConfirmOpen(false); }}>
                Cancel
              </Button>
              <Button color="red" onClick={(e) => { e.stopPropagation(); setConfirmOpen(false); wbRef.current?.cancelProcessing?.(); closePortal(); }}>
                Close importer
              </Button>
            </Group>
          </Modal>
        </div>
      </Providers>
    </div>
  );

  if (!open || !portalContainer) {
    return null;
  }

  return createPortal(inner, portalContainer);
}


