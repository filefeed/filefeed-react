# Filefeed SDK

An embeddable React SDK for data onboarding: import CSV/XLS(X), map columns to your schema, apply transforms and validations, review, and submit.

## Features

- CSV/XLS/XLSX import with drag-and-drop
- CSV encoding detection and header/value trimming
- Mapping UI with AI-ready structure and safe transform registry
- Field validations (required/type/regex/min/max) + cross-row uniqueness
- Automatic small-file client processing; optional paid large-file offload (>10MB) via FileFeed backend (subscription required)
- Drop-in component with minimal config
- Imperative `reset()` and events for analytics/hooks

## Installation

```
npm install filefeed-sdk
```

That’s it. No additional installs, providers, or CSS imports are required. The SDK bundles its UI runtime and styles. Requires React 17+ in your app.

## Quick start

```tsx
import React, { useRef } from "react";
import {
  FilefeedWorkbook,
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

## Large files (automatic offload — FileFeed subscription required)

This feature is available only with an active FileFeed subscription. Offloading files larger than 10MB to the FileFeed backend is disabled by default. If you have access, configure once in your app:

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

Note: Without a subscription (or without calling `configureBackendClient`), the SDK will process files locally in the browser, regardless of size.

## Events & imperative API

- `onStepChange(step)` – "import" | "mapping" | "review"
- `onWorkbookComplete(rows)` – final processed `DataRow[]`
- `onReset()` – fired when you call `reset()`
- `ref.reset()` – resets UI and store to the initial import view

<!-- Headless utilities are not part of the UI-only package release -->

## License

MIT Filefeed
