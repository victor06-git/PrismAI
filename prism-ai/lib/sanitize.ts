/**
 * Sanitizes text coming from the backend (transcript segments, LLM-generated
 * ticket/insight strings) before it's stored in UI state.
 *
 * Honest scope: React/JSX already HTML-escapes every string it renders via
 * `{value}` — none of PrismAI's components use `dangerouslySetInnerHTML`, so
 * there is no exploitable script-injection path today. This is defense in
 * depth for two real things it DOES protect against:
 *   1. A future code path (e.g. markdown rendering) that adds
 *      dangerouslySetInnerHTML without re-deriving this analysis.
 *   2. Confusing/spoofed-looking UI if a transcript or an LLM output happens
 *      to contain literal HTML-ish text (stripped here so it can't visually
 *      masquerade as real interface chrome).
 * It does not replace validating/rate-limiting the pipeline that produces
 * this text in the first place — see backend/rate_limit.py for that.
 */

import DOMPurify from "dompurify";

/** Strips all markup, leaving plain text — the right default for ticket titles, transcript lines, etc. */
export function sanitizeText(value: string): string {
  if (typeof window === "undefined") return value; // SSR: DOMPurify needs a DOM; nothing to sanitize server-side here anyway
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

/** Sanitizes every string field of a shallow object in place (returns a new object). */
export function sanitizeFields<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): T {
  const result = { ...obj };
  for (const key of keys) {
    const value = result[key];
    if (typeof value === "string") {
      result[key] = sanitizeText(value) as T[typeof key];
    }
  }
  return result;
}
