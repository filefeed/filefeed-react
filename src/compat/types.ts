import type { CreateWorkbookConfig as CoreCreateWorkbookConfig } from "../types";

export namespace FileFeed {
  export type CreateWorkbookConfig = CoreCreateWorkbookConfig;
  export type RecordDataWithLinks = Record<string, { value: any }>;
}
