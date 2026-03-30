/**
 * PII Sanitizer — Privacy by Design
 * ───────────────────────────────────
 * Strips personally identifiable information from strings before
 * they enter OTel span events or structured logs.
 *
 * Patterns masked:
 *   • Credit/debit card numbers (Visa, Mastercard, Amex patterns)
 *   • Email addresses
 *   • Argentine DNI / CUIT / CUIL (XX-XXXXXXXX-X)
 *   • Phone numbers (10+ digit sequences with optional country code)
 *   • Argentine CBU (22-digit bank account)
 */

const PATTERNS: Array<{ regex: RegExp; label: string }> = [
  // Credit cards: 13-19 digit sequences (with optional separators)
  { regex: /\b(?:\d[ -]*?){13,19}\b/g, label: "[CARD_REDACTED]" },
  // Emails
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "[EMAIL_REDACTED]" },
  // Argentine CUIT/CUIL: XX-XXXXXXXX-X
  { regex: /\b\d{2}-\d{7,8}-\d{1}\b/g, label: "[CUIT_REDACTED]" },
  // Phone numbers: +54 11 XXXX-XXXX or 10+ digit sequences
  {
    regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g,
    label: "[PHONE_REDACTED]",
  },
  // CBU (22 digits)
  { regex: /\b\d{22}\b/g, label: "[CBU_REDACTED]" },
];

/**
 * Masks all PII patterns found in the input string.
 * Returns a sanitized copy; the original is never mutated.
 */
export function sanitizePII(input: string): string {
  let result = input;
  for (const { regex, label } of PATTERNS) {
    result = result.replace(regex, label);
  }
  return result;
}

/**
 * Recursively sanitizes all string values in a plain object.
 * Non-string leaves are left untouched.
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === "string") return sanitizePII(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map(sanitizeObject) as unknown as T;
  if (obj && typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = sanitizeObject(value);
    }
    return cleaned as T;
  }
  return obj;
}
