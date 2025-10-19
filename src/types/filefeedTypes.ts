export namespace Filefeed {
  export type Field = {
    key: string;
    type: string; // "string" | "number" | "email" | ...
    label?: string;
    required?: boolean;
    unique?: boolean;
  };

  export type SheetConfig = {
    name: string;
    slug: string;
    fields: Field[];
  };

  // lightweight Record API mirrored to support onRecordHook ergonomics
  export type RecordAPI = {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    toObject: () => Record<string, any>;
  };
}


