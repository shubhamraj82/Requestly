"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { compareSamples, type Difference, type Sample } from "./diff";

export function useBaseline(scope: string) {
  const cache = useQueryClient();
  const key = ["response-baseline", scope];
  const { data: baseline } = useQuery<Sample | null>({
    queryKey: key,
    enabled: false,
    gcTime: Infinity,
    initialData: null,
  });
  function pin(sample?: Sample) {
    cache.setQueryData(key, sample ?? null);
  }
  return { baseline, pin };
}

function AiExplanation({ changes }: { changes: Difference[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function explain() {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/explain-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: changes.slice(0, 24).map(({ path, kind, detail }) => ({
          path: path.slice(0, 160), kind, types: kind === "Type changed" ? detail : undefined,
        })) }),
      });
      const data = await res.json();
      setMessage(res.ok ? data.summary : data.error);
    } catch {
      setMessage("Couldn’t load an explanation. You can try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 border-t border-border pt-3">
      <Button size="sm" variant="outline" disabled={busy} onClick={explain}>
        {busy ? "Explaining…" : "Explain impact with AI"}
      </Button>
      <div role="status" aria-live="polite" aria-atomic="true">
        {message && (
          <div className="mt-3 max-w-prose space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 wrap-anywhere sm:px-5">
            {message.trim().split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RestResponseChanges({ scope, current }: { scope: string; current: Sample }) {
  const controls = useBaseline(scope);
  return <ResponseChanges {...controls} current={current} />;
}

export function ResponseChanges({ current, baseline, pin }: ReturnType<typeof useBaseline> & { current?: Sample }) {
  const result = baseline && current ? compareSamples(baseline, current) : undefined;
  return <section aria-label="Response comparison" className="space-y-3 p-3 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={!current || (current.label === baseline?.label && current.body === baseline.body && current.status === baseline.status)} onClick={() => pin(current)}>
        {baseline ? "Replace baseline" : "Pin as baseline"}
      </Button>
      {baseline && <Button size="sm" variant="ghost" onClick={() => pin()}>Unpin</Button>}
    </div>
    <p className="text-muted-foreground">{baseline ? `Baseline · ${baseline.label}` : "Pin a known-good response. New responses will be compared automatically."}</p>
    {!current && <p>Waiting for a received message…</p>}
    {result && current && <div className="space-y-2">
      <p>{current.label} · {result.limited ? "Partial comparison" : result.changes.length ? `${result.changes.length} change${result.changes.length === 1 ? "" : "s"}` : "Matches baseline"}</p>
      {result.limited && <p>Showing up to 80 changes and 100 levels of nesting.</p>}
      <ul className="max-h-72 overflow-auto divide-y divide-border">
        {result.changes.map(({ path, kind, detail }, index) => <li key={index} className="break-all py-2">
          <span className={kind === "Removed" || kind === "Type changed" ? "text-amber-400" : "text-sky-400"}>{kind}</span>
          {" · "}<code>{path}</code><div>{detail}</div>
        </li>)}
      </ul>
      {!!result.changes.length && <AiExplanation key={JSON.stringify(result.changes)} changes={result.changes} />}
    </div>}
  </section>;
}
