export function urlProblem(input: string) {
  const value = input.trim();
  if (!value) return "Enter a request URL.";
  if (!/^https?:\/\//i.test(value)) return "Start the URL with http:// or https://.";
  try {
    if (!/^https?:\/\/[^/\\?#\s]/i.test(value)) throw new Error();
    new URL(value);
  } catch {
    return "Invalid URL. Check the host name and port, for example https://example.com:443/path.";
  }
}

export function jsonProblem(body: string) {
  if (!body) return;
  try {
    JSON.parse(body);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Check the JSON syntax.";
    return `Invalid JSON. ${detail}`;
  }
}

type Header = { key: string; value: string; enabled?: boolean };

export function headerRows(raw?: string): Header[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(row => row && typeof row.key === "string");
    return Object.entries(parsed).map(([key, value]) => ({ key, value: String(value) }));
  } catch {
    return [];
  }
}

export function mediaType(raw?: string) {
  return headerRows(raw).filter(row => row.enabled !== false && row.key.toLowerCase() === "content-type").at(-1)?.value;
}

export function isJsonType(type?: string) {
  return !type || /^(?:application\/json|[^;\s]+\+json)(?:\s*;|$)/i.test(type.trim());
}

export function withContentType(raw: string | undefined, type: string) {
  return JSON.stringify([...headerRows(raw).filter(row => row.key.toLowerCase() !== "content-type"), { key: "Content-Type", value: type, enabled: true }]);
}

export function connectionProblem(code: string | undefined, detail: string) {
  switch (code) {
    case "ENOTFOUND": return "Host name could not be found. Check the domain in the URL.";
    case "ECONNREFUSED": return "Connection refused. Check the port and whether the API server is running.";
    case "ETIMEDOUT":
    case "ECONNABORTED": return "Connection timed out. Check the host and try again.";
    case "ECONNRESET": return "The connection closed before the server returned a response.";
    default: return detail;
  }
}
