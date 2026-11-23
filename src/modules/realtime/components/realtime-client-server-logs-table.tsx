"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, endpoint, type Entry, type Run } from "../hooks/useWs";
import { toast } from "sonner";

export default function Timeline({
  workspace,
  runId,
  onStatus,
  onEnd,
}: {
  workspace: string;
  runId: string;
  onStatus: (status: string) => void;
  onEnd: (run: Run) => void;
}) {
  const [events, setEvents] = useState<Entry[]>([]);
  const [older, setOlder] = useState<Entry[] | null>(null);
  const [info, setInfo] = useState<Run | null>(null);
  const [issue, setIssue] = useState("");
  useEffect(() => {
    let alive = true,
      stream: EventSource | undefined;
    const url = (params: Record<string, string> = {}) =>
      endpoint(workspace, { run: runId, ...params });
    const details = () => api<{ run: Run; events: Entry[] }>(url());
    void details()
      .then(({ run, events }) => {
        if (!alive) return;
        setInfo(run);
        setEvents(events);
        onStatus(run.status);
        if (run.endedAt) {
          onEnd(run);
          return;
        }
        stream = new EventSource(
          url({ stream: "1", after: String(events.at(-1)?.seq || 0) }),
        );
        stream.onopen = () => setIssue("");
        stream.onerror = () => setIssue("Reconnecting to event history…");
        stream.onmessage = (e) => {
          const row: Entry = JSON.parse(e.data);
          setEvents((old) =>
            row.seq <= (old.at(-1)?.seq || 0) ? old : [...old, row].slice(-100),
          );
        };
        stream.addEventListener("status", (e) =>
          onStatus(JSON.parse(e.data).status),
        );
        stream.addEventListener("end", () => {
          stream?.close();
          void details()
            .then(({ run }) => {
              if (alive) {
                setInfo(run);
                onEnd(run);
              }
            })
            .catch(() => setIssue("Failed to reload run details"));
        });
      })
      .catch((error) => {
        if (alive) setIssue(error.message);
      });
    return () => {
      alive = false;
      stream?.close();
    };
  }, [workspace, runId, onStatus, onEnd]);
  const rows = older ?? events;
  return (
    <section className="space-y-2">
      {issue && <p role="status">{issue}</p>}
      {info && (
        <details>
          <summary>Connection details</summary>
          <pre className="overflow-auto">{JSON.stringify(info, null, 2)}</pre>
        </details>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={(rows[0]?.seq ?? 0) <= 1}
          onClick={async () => {
            try {
              const result = await api<{ events: Entry[] }>(
                endpoint(workspace, {
                  run: runId,
                  before: String(rows[0].seq),
                }),
              );
              setOlder(result.events);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          Older events
        </Button>
        {older && (
          <Button onClick={() => setOlder(null)}>Return to live</Button>
        )}
      </div>
      {[...rows].reverse().map((row) => (
        <details
          key={row.seq}
          className="ws-event border-b py-2"
          data-kind={row.kind}
        >
          <summary className="cursor-pointer font-mono text-sm">
            #{row.seq} · {new Date(row.createdAt).toLocaleTimeString()} ·{" "}
            {row.kind} · {row.format} · {row.bytes} B
          </summary>
          <pre className="whitespace-pre-wrap break-all">{row.payload}</pre>
        </details>
      ))}
    </section>
  );
}
