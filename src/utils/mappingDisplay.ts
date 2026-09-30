import type { FieldConfig } from "../types";

/** ALL CAPS or snake_case headers read better in monospace. */
export function headerLooksLikeCode(header: string): boolean {
  const h = header.trim();
  if (!h) return false;
  if (h.includes("_")) return true;
  return /[A-Z]/.test(h) && !/[a-z]/.test(h);
}

const normalizeName = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Header equals the target label or key once punctuation and case are ignored. */
export function isExactHeaderMatch(header: string, field: FieldConfig): boolean {
  const h = normalizeName(header);
  return h.length > 0 && (h === normalizeName(field.label) || h === normalizeName(field.key));
}
