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

## Transforms and Validations

The SDK supports per-field transforms and validations that run during processing and manual edits in Review.

- A "transform" is a named function applied before type coercion and validation.
- A "validation" can be built-in (required/type/min/max/regex) or custom via a registry of named functions.

You can provide both registries on the root `CreateWorkbookConfig` so they are available in the Mapping UI and processing engine:

```ts
import type { CreateWorkbookConfig } from "filefeed-sdk";

const transformRegistry = {
  trim: (v: any) => (v == null ? v : String(v).trim()),
  toLowerCase: (v: any) => (v == null ? v : String(v).toLowerCase()),
  formatEmail: (v: any) => (v == null ? v : String(v).trim().toLowerCase()),
  formatPhoneNumber: (v: any) => (v == null ? v : String(v).replace(/[^0-9]/g, "")),
};

const validationRegistry = {
  // Return true/undefined for valid, or false/string/object for invalid
  domainWhitelist: (
    value: any,
    field: any,
    rowIndex: number,
    rowData: Record<string, any>,
    args?: { allowed: string[] }
  ) => {
    if (!value) return true;
    const allowed = args?.allowed || ["gmail.com", "company.com"];
    const domain = String(value).split("@")[1] || "";
    return allowed.includes(domain) || `Email domain '${domain}' is not allowed`;
  },
};

const config: CreateWorkbookConfig = {
  name: "Customer Import",
  transformRegistry,
  validationRegistry,
  sheets: [
    {
      name: "Customers",
      slug: "customers",
      fields: [
        {
          key: "email",
          label: "Email",
          type: "email",
          required: true,
          unique: true,
          // Default transform applied when this field is mapped (user can override in Mapping UI)
          defaultTransform: "formatEmail",
          validations: [
            { type: "regex", value: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", message: "Invalid email" },
            { type: "custom", name: "domainWhitelist", args: { allowed: ["gmail.com"] }, message: "Bad domain" },
          ],
        },
        {
          key: "phone",
          label: "Phone",
          type: "string",
          defaultTransform: "formatPhoneNumber",
          validations: [
            { type: "regex", value: "^\\+?[0-9]{7,15}$", message: "Phone must be 7–15 digits" },
          ],
        },
      ],
    },
  ],
};
```

### Mapping UI and default transforms

- The Mapping step shows a Transform dropdown per mapped source column (if a transform registry is provided).
- If a mapping-level transform isn’t chosen, the SDK applies `FieldConfig.defaultTransform` by default.
- You can pre-seed mapping transforms via `pipelineMappings.fieldMappings[].transform`.

### Validation execution order

1. Apply transform (mapping-level or `defaultTransform`)
2. Coerce type based on `FieldConfig.type`
3. Validate: required/type/regex/min/max and any custom validators from `validationRegistry`
4. Uniqueness rules run after mapping on a dedicated pass

### Custom validators (by name)

A custom validator receives `(value, field, rowIndex, rowData, args)` and can return:

- `true | undefined | null` for valid
- `false` or a `string` (error message) for invalid
- a `ValidationError` object for advanced scenarios

See the registry example above.

## CRA example (complete)

In Create React App (or any React app), you can wire registries and defaults directly in the `config` you pass to `FilefeedWorkbook`.

```tsx
import React, { useRef, useState } from "react";
import FilefeedWorkbook from "filefeed-sdk";

const transformRegistry = {
  trim: (v: any) => (v == null ? v : String(v).trim()),
  toSlug: (v: any) =>
    v == null
      ? v
      : String(v)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
  formatEmail: (v: any) => (v == null ? v : String(v).trim().toLowerCase()),
  formatPhoneNumber: (v: any) => (v == null ? v : String(v).replace(/[^0-9]/g, "")),
};

const validationRegistry = {
  domainWhitelist: (value: any, _f: any, _row: number, _rowData: any, args?: { allowed: string[] }) => {
    if (!value) return true;
    const allowed = args?.allowed || ["gmail.com", "company.com"];
    const domain = String(value).split("@")[1] || "";
    return allowed.includes(domain) || `Email domain '${domain}' is not allowed`;
  },
};

const config = {
  name: "Customer Import",
  transformRegistry,
  validationRegistry,
  sheets: [
    {
      name: "Customers",
      slug: "customers",
      fields: [
        { key: "email", label: "Email", type: "email", required: true, unique: true, defaultTransform: "formatEmail",
          validations: [
            { type: "regex", value: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", message: "Invalid email" },
            { type: "custom", name: "domainWhitelist", args: { allowed: ["gmail.com"] } },
          ] },
        { key: "firstName", label: "First Name", type: "string" },
        { key: "lastName", label: "Last Name", type: "string" },
        { key: "phone", label: "Phone", type: "string", defaultTransform: "formatPhoneNumber" },
      ],
      pipelineMappings: {
        fieldMappings: [
          { source: "Email", target: "email", transform: "formatEmail" },
          { source: "Email Address", target: "email", transform: "formatEmail" },
          { source: "Mobile", target: "phone", transform: "formatPhoneNumber" },
        ],
      },
    },
  ],
};

export default function App() {
  const ref = useRef(null);
  const [open, setOpen] = useState(true);
  return open ? (
    <FilefeedWorkbook
      ref={ref}
      config={config}
      events={{
        onWorkbookComplete: (rows) => console.log("Done:", rows),
      }}
    />
  ) : null;
}
```

## Behavior notes

- Processing runs only when the user clicks Continue on the Mapping step. Mapping changes do not auto-process for large datasets (to avoid churn); small datasets may be processed quickly.
- Review step includes:
  - Filtering by All / Valid / Invalid
  - Per-row delete and a "Delete all invalid" action
  - Edits re-validate the row live using the same rules
- Uniqueness validation is applied after mapping (e.g., duplicate emails across rows).

## Pipeline mappings

Pipeline mappings are an optional, backend-compatible description of the mapping you want the SDK to apply. They live on `SheetConfig.pipelineMappings` and look like:

```ts
type FieldMapping = {
  source: string;   // incoming header name
  target: string;   // your field key
  transform?: string;  // optional transform name
};

type PipelineMappings = {
  fieldMappings: FieldMapping[];
  transformations?: Record<string, string>; // reserved for server-side compatibility
  validations?: Record<string, any>;        // optional, for advanced use
};
```

If `pipelineMappings` are omitted, the SDK will auto-map using `mappingConfidenceThreshold` and still apply `defaultTransform` for each field when mapped.

## Type reference (selected)

```ts
type FieldType = "string" | "number" | "email" | "date" | "boolean";

interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  description?: string;
  defaultTransform?: string;      // name in transformRegistry
  validations?: ValidationRule[]; // built-in or custom rules
}

interface ValidationRule {
  type: "regex" | "min" | "max" | "custom";
  value?: any;     // regex pattern for type=regex; numeric for min/max
  message: string; // error message
  name?: string;   // custom validator name in validationRegistry
  args?: any;      // optional args passed to custom validator
}

type TransformRegistry = Record<string, (value: any) => any>;
type ValidationRegistry = Record<string, (
  value: any,
  field: FieldConfig,
  rowIndex: number,
  rowData: Record<string, any>,
  args?: any
) => string | ValidationError | null | undefined | boolean>;

interface DataRow {
  id: string;
  data: Record<string, any>;
  errors: ValidationError[];
  isValid: boolean;
}
```

## Troubleshooting

- If transforms aren’t showing in the Mapping UI, ensure you provided a `transformRegistry` on `config`.
- If your custom validator isn’t running, ensure `validationRegistry` is provided and the field rule uses `type: "custom"` with a matching `name`.
- If mapping a large file, processing won’t auto-start until you click Continue (by design to avoid churn). Small files process quickly.


## Contact / Support

Questions, feedback, or enterprise pricing?  
📬 Email: [igor@sftpsync.io](mailto:igor@sftpsync.io)

- Bug reports: please open an issue on GitHub (include repro + sample file)
- Security: email with subject **[SECURITY]** to the address above
- Partnerships & enterprise: same email, subject **[ENTERPRISE]**


## License

MIT Filefeed
