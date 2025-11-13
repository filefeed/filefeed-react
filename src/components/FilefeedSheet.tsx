import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFilefeed } from "../hooks/useFilefeed";
import type { Filefeed } from "../types/filefeedTypes";
import { ActionIcon, Modal, Group, Button, Text } from "@mantine/core";
import { Providers } from "../app/providers";

// Use existing primitives from this package
import FilefeedWorkbook from "./FilefeedWorkbook";
import type { CreateWorkbookConfig, ProcessingOptions, DataRow, FilefeedWorkbookRef } from "../types";

type Props<S extends Filefeed.SheetConfig> = {
  config: S;
  onSubmit?: Filefeed.SubmitHandler<S>;
  onRecordHook?: (record: Filefeed.TypedRecordAPI<S>) => Filefeed.TypedRecordAPI<S> | void;
  autoCloseOnComplete?: boolean;
  processing?: ProcessingOptions;
  importOptions?: ProcessingOptions; // alias for processing
};

function mapField(f: Filefeed.Field) {
  return { ...f };
}

function makeRecordAPI<S extends Filefeed.SheetConfig>(row: Record<string, any>): Filefeed.TypedRecordAPI<S> {
  const data: Record<string, any> = { ...row };
  return {
    get: (k) => data[k as string],
    set: (k, v) => {
      data[k as string] = v;
    },
    toObject: () => ({ ...(data as any) }),
  } as Filefeed.TypedRecordAPI<S>;
}

function applyRecordHook<S extends Filefeed.SheetConfig>(rows: any[], hook?: (r: Filefeed.TypedRecordAPI<S>) => Filefeed.TypedRecordAPI<S> | void) {
  if (!hook) return rows as any[];
  return rows.map((row) => {
    const rec = makeRecordAPI<S>(row);
    const out = hook(rec);
    if (out) {
      return out.toObject();
    }
    return rec.toObject();
  });
}

export function FilefeedSheet<S extends Filefeed.SheetConfig>({ config, onSubmit, onRecordHook, autoCloseOnComplete = true, processing, importOptions }: Props<S>) {
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
      style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, background: "rgba(0,0,0,0.4)" }}
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
                const transformed = applyRecordHook<S>(normalized, onRecordHook as any);
                (onSubmit as any)?.({ rows: transformed, slug: config.slug });
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
                const transformed = applyRecordHook<S>(normalized, onRecordHook as any);
                await (onSubmit as any)?.({ rows: transformed, slug: config.slug });
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


