export interface Sample {
  label: string;
  body: unknown;
  status?: number;
  format?: "text" | "binary";
}

type Kind = "Added" | "Removed" | "Type changed" | "Changed";
export type Difference = { path: string; kind: Kind; detail: string };

function decode(sample: Sample): unknown {
  if (sample.format !== "text" || typeof sample.body !== "string") return sample.body;
  try {
    return JSON.parse(sample.body);
  } catch {
    return sample.body;
  }
}

function typeOf(value: unknown) {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function preview(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value.length > 90 ? value.slice(0, 90) + "…" : value);
  }
  if (Array.isArray(value)) return `array (${value.length} items)`;
  if (value && typeof value === "object") return "object";
  return String(value);
}

export function compareSamples(before: Sample, after: Sample) {
  const changes: Difference[] = [];
  let limited = false;
  function add(path: string, kind: Kind, detail: string) {
    if (changes.length < 80) changes.push({ path, kind, detail });
    else limited = true;
  }
  function visit(a: unknown, b: unknown, path: string, depth: number) {
    if (a === b || limited) return;
    const from = typeOf(a);
    const to = typeOf(b);
    if (from !== to) {
      add(path || "Body", "Type changed", `${from} → ${to}. Clients expecting ${from} may fail.`);
    } else if (a && b && typeof a === "object" && typeof b === "object") {
      if (depth >= 100) {
        limited = true;
        return;
      }
      const left = a as Record<string, unknown>;
      const right = b as Record<string, unknown>;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        const child = Array.isArray(a) ? `${path}[${key}]`
          : /^[A-Za-z_$][\w$]*$/.test(key) ? [path, key].filter(Boolean).join(".")
          : `${path}[${JSON.stringify(key)}]`;
        if (!Object.hasOwn(right, key)) add(child, "Removed", preview(left[key]));
        else if (!Object.hasOwn(left, key)) add(child, "Added", preview(right[key]));
        else visit(left[key], right[key], child, depth + 1);
        if (limited) break;
      }
    } else {
      let detail = `${preview(a)} → ${preview(b)}`;
      if (typeof a === "string" && typeof b === "string" && a.slice(0, 90) === b.slice(0, 90)) {
        let offset = 0;
        while (offset < a.length && offset < b.length && a[offset] === b[offset]) offset++;
        const start = Math.max(0, offset - 12);
        detail = `At character ${offset + 1}: ${preview(a.slice(start, offset + 48))} → ${preview(b.slice(start, offset + 48))}`;
      }
      add(path || "Body", "Changed", detail);
    }
  }
  if (before.status !== after.status) add("HTTP status", "Changed", `${before.status} → ${after.status}`);
  if (before.format !== after.format) add("Message format", "Type changed", after.format === "binary" ? "Text → binary" : "Binary → text");
  visit(decode(before), decode(after), "", 0);
  return { changes, limited };
}
