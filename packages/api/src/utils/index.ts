export function getChildValue(data: unknown, key: string): unknown {
  let value: unknown = data;
  for (const part of key.split(".")) {
    if (value === null || value === undefined) return null;
    if (typeof value === "object" && !Array.isArray(value)) {
      value = (value as Record<string, unknown>)[part];
    } else if (Array.isArray(value)) {
      const idx = parseInt(part, 10);
      value = isNaN(idx) ? null : value[idx];
    } else {
      return null;
    }
  }
  return value ?? null;
}

export function getFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function getHexTempIntoIndex(value: string | null | undefined): number | null {
  if (value == null) return null;
  const cleaned = value.replace("H", "");
  const parsed = parseInt(cleaned, 16);
  return isNaN(parsed) ? null : parsed;
}

export function getIndexIntoHexTemp(value: number | null | undefined): string | null {
  if (value == null) return null;
  const hex = value.toString(16).toUpperCase();
  return (hex + "H").padStart(3, "0");
}

export function parseIsoDatetime(value: string | null | undefined): Date | null {
  if (value == null) return null;
  // Try RFC 2822: "Tue, 24 Jun 2025 16:18:10 GMT"
  const rfc = Date.parse(value);
  if (!isNaN(rfc)) return new Date(rfc);
  // Try compact: 20231024153000
  const cleaned = value
    .replace(/-/g, "")
    .replace(/T/g, "")
    .replace(/:/g, "")
    .replace(/Z/g, "");
  const m = cleaned.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (m) {
    return new Date(
      `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
    );
  }
  return null;
}

export function parseDateBr(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  if (dateString.length >= 14) {
    const m = dateString.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  }
  if (dateString.length >= 8) {
    const m = dateString.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  }
  return null;
}

export function getTimeFromString(value: string | null, timesection: number): string | null {
  if (value == null) return null;
  let v = parseInt(value, 10);
  const lastTwo = v % 100;
  if (lastTwo > 60) v += 40;
  let hour = Math.floor(v / 100);
  const minute = v % 100;
  if (v <= 1260) {
    if (timesection > 0) hour += 12;
    if (hour >= 24) hour -= 24;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
