// Ambient module declaration for jschardet to satisfy TypeScript in the browser SDK
// This keeps our code strongly typed without bringing in @types

declare module 'jschardet' {
  export interface DetectionResult {
    encoding?: string;
    confidence?: number;
    language?: string;
  }

  export function detect(
    input: Uint8Array | ArrayBuffer | string
  ): DetectionResult;

  const _default: {
    detect: typeof detect;
  };

  export default _default;
}
