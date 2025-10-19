import React from "react";
import { createPortal } from "react-dom";
import { useFilefeed } from "../hooks/useFilefeed";
import { eventBus } from "../internal/eventBus";
import type { Filefeed } from "../types/filefeedTypes";

// Use existing primitives from this package
import FilefeedWorkbook from "./FilefeedWorkbook";
import type { CreateWorkbookConfig } from "../types";

type Props = {
  config: Filefeed.SheetConfig;
  onSubmit?: (sheet: { rows: any[]; slug: string }) => Promise<void> | void;
  onRecordHook?: (record: Filefeed.RecordAPI) => Filefeed.RecordAPI | void;
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

export function FilefeedSheet({ config, onSubmit, onRecordHook }: Props) {
  const { open, portalContainer } = useFilefeed();

  const wbConfig: CreateWorkbookConfig = {
    name: config.name,
    sheets: [
      {
        name: config.name,
        slug: config.slug,
        fields: config.fields.map(mapField) as any,
      },
    ],
  };

  // Inner UI to render inside the portal when open
  const inner = (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
      <div style={{ width: "90%", maxWidth: 1200, background: "#fff", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <FilefeedWorkbook
          config={wbConfig}
          events={{
            onStepChange: (step: any) => {
              eventBus.emit("step:change", { step, slug: config.slug });
            },
            onWorkbookComplete: (rows: any[]) => {
              const normalized = Array.isArray(rows)
                ? rows.map((r) => (r && typeof r === "object" && "data" in r ? (r as any).data : r))
                : [];
              const transformed = applyRecordHook(normalized, onRecordHook);
              eventBus.emit("workbook:complete", {
                operation: `sheetSubmitAction-${config.slug}`,
                status: "complete",
                slug: config.slug,
                rows: transformed,
              });
              onSubmit?.({ rows: transformed, slug: config.slug });
            },
            onReset: () => {
              eventBus.emit("workbook:reset", { slug: config.slug });
            },
          }}
        />
      </div>
    </div>
  );

  if (!open || !portalContainer) {
    return null;
  }

  return createPortal(inner, portalContainer);
}


