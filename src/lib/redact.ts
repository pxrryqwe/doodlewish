const REDACTED_KEYS = /token|password|secret|key|note|name/i;

export function redact<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map(redact) as unknown as T;
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (REDACTED_KEYS.test(k)) {
        out[k] = typeof v === "string" ? "[redacted]" : v;
      } else {
        out[k] = redact(v);
      }
    }
    return out as T;
  }
  return input;
}

export function logSafe(label: string, payload: unknown) {
  console.log(label, redact(payload));
}
