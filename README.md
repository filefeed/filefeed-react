# Filefeed SDK

An embeddable React SDK for data onboarding: import CSV/XLS(X), map columns to your schema, apply transforms and validations, review, and submit.

## Features

- CSV/XLS/XLSX import with drag-and-drop
- CSV encoding detection and header/value trimming
- Mapping UI with AI-ready structure and safe transform registry
- Field validations (required/type/regex/min/max) + cross-row uniqueness
- Automatic small-file client processing, auto offload >10MB to your backend (optional)
- Drop-in component with minimal config; also supports headless utilities
- Imperative `reset()` and events for analytics/hooks

## Installation

```
npm install filefeed-sdk
```

Peer dependencies (install in your app if not already present):

```
npm install react react-dom @mantine/core @mantine/hooks @mantine/dropzone @mantine/notifications @mantine/modals @mantine/dates @tabler/icons-react
```

## App setup (Mantine providers)

```tsx
// app/layout.tsx (Next.js) or a top-level client component
"use client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <MantineProvider defaultColorScheme="light">
          <Notifications />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
```

## Quick start

```tsx
"use client";
import React, { useRef } from "react";
import FilefeedWorkbook, {
  type CreateWorkbookConfig,
  type FilefeedWorkbookRef,
} from "filefeed-sdk";

const config: CreateWorkbookConfig = {
  name: "Customer Import",
  sheets: [
    {
      name: "Customers",
      slug: "customers",
      mappingConfidenceThreshold: 0.7,
      fields: [
        {
          key: "email",
          label: "Email",
          type: "email",
          required: true,
          unique: true,
        },
        {
          key: "firstName",
          label: "First Name",
          type: "string",
          required: true,
        },
        { key: "lastName", label: "Last Name", type: "string", required: true },
        { key: "age", label: "Age", type: "number" },
      ],
      // Optional: seed mappings compatible with the backend
      // pipelineMappings: { fieldMappings: [{ source: "Email", target: "email", transform: "formatEmail" }] },
    },
  ],
};

export default function Page() {
  const ref = useRef<FilefeedWorkbookRef>(null);
  return (
    <FilefeedWorkbook
      ref={ref}
      config={config}
      events={{
        onStepChange: (step) => console.log("Step:", step),
        onWorkbookComplete: (rows) => console.log("Done:", rows),
      }}
    />
  );
}
```

## Large files (automatic offload, optional)

Configure once to automatically offload files >10MB to your backend:

```ts
import { configureBackendClient } from "filefeed-sdk";

configureBackendClient({
  getUploadUrl: async (file, ctx) => {
    const res = await fetch(
      "/api/presign?name=" + encodeURIComponent(file.name)
    );
    const { url, method, fields, headers, key } = await res.json();
    return { url, method, fields, headers, key };
  },
  startProcessing: async ({ uploadKey }) => {
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: uploadKey }),
    });
    const { jobId } = await res.json();
    return { jobId };
  },
  pollResult: async (jobId) => {
    const res = await fetch("/api/status?jobId=" + encodeURIComponent(jobId));
    const json = await res.json();
    return { done: json.done, error: json.error, rows: json.rows };
  },
});
```

## Events & imperative API

- `onStepChange(step)` – "import" | "mapping" | "review"
- `onWorkbookComplete(rows)` – final processed `DataRow[]`
- `onReset()` – fired when you call `reset()`
- `ref.reset()` – resets UI and store to the initial import view

## Headless utilities

```ts
import {
  parseCSV,
  parseExcel,
  processImportedDataWithMappings,
  defaultTransforms,
  type PipelineMappings,
  type FieldConfig,
} from "filefeed-sdk";

async function process(file: File, fields: FieldConfig[]) {
  const imported = file.name.endsWith(".csv")
    ? await parseCSV(file)
    : await parseExcel(file);
  const pipeline: PipelineMappings = {
    fieldMappings: [
      { source: "Email", target: "email", transform: "formatEmail" },
    ],
  };
  return processImportedDataWithMappings(
    imported,
    fields,
    pipeline,
    defaultTransforms
  );
}
```

## Build and publish (library authors)

```
# build artifacts into dist/
npm run build-lib

# sanity check package contents
npm pack

# publish (needs npm login)
npm publish --access public
```

This package ships CJS and ESM builds with type declarations and marks React/Mantine as peer dependencies to avoid duplicates.

## License

MIT Filefeed
