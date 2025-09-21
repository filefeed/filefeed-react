"use client";

// Public client entry that forces the bundle to be treated as a Client Component
// in frameworks like Next.js (app router). Re-export everything from the
// canonical index while ensuring default export is preserved.

export * from "./index";
export { default } from "./components/FilefeedWorkbook";
