"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import "./tester.css";
import {
  Activity,
  Radio,
  Terminal,
  FolderOpen,
  History,
  Cable,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceStore } from "@/modules/layout/store";
import { defaults, type Settings } from "@/modules/realtime/settings";
import {
  api,
  type Run,
  type Definition,
  useSockets,
} from "@/modules/realtime/hooks/useWs";
import {useAccess} from "@/modules/workspace/hooks/workspace";
import ConnectionBar from "@/modules/realtime/components/realtime-connection-bar";
import MessageEditor from "@/modules/realtime/components/realtime-message-editor";
import Timeline from "@/modules/realtime/components/realtime-client-server-logs-table";

export default function Page() {
  const workspace = useWorkspaceStore((s) => s.selectedWorkspace?.id);
  const initial = useSearchParams().get("socket") || "";
  return workspace ? (
    <Tester key={workspace + initial} workspace={workspace} initial={initial} />
  ) : (
    <p className="p-6">Select a workspace to test a WebSocket.</p>
  );
}
function Tester({
  workspace,
  initial,
}: {
  workspace: string;
  initial: string;
}) {
  const access=useAccess();
  const [cursor, setCursor] = useState("");
  const listing = useSockets(workspace, cursor);
  const cache = useQueryClient();
  const [settings, change] = useState<Settings>(defaults);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [collection, setCollection] = useState("");
  const [run, setSelectedRun] = useState(() =>
    initial || typeof window === "undefined"
      ? ""
      : sessionStorage.getItem("socket-run:" + workspace) || "",
  );
  const setRun = useCallback(
    (value: string) => {
      setSelectedRun(value);
      sessionStorage.setItem("socket-run:" + workspace, value);
    },
    [workspace],
  );
  const [status, setStatus] = useState("disconnected");
  const [busy, setBusy] = useState(false);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const plan = useRef<{
    body: Record<string, unknown>;
    attempt: number;
    enabled: boolean;
  } | null>(null);
  const invalidate = useCallback(
    () => cache.invalidateQueries({ queryKey: ["sockets", workspace] }),
    [cache, workspace],
  );
  const post = useCallback(
    (args: Record<string, unknown>) =>
      api<{ id: string }>("/api/realtime", { workspace, ...args }),
    [workspace],
  );
  const cancel = useCallback(() => {
    generation.current++;
    clearTimeout(retry.current);
    plan.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const choose = useCallback(
    (d?: Definition) => {
      cancel();
      setRun("");
      setStatus("disconnected");
      setId(d?.id || "");
      setName(d?.name || "");
      setCollection(d?.collectionId || "");
      change(d?.settings || defaults);
      setSecrets({});
    },
    [cancel, setRun],
  );
  const opened = useRef(false);
  useEffect(() => {
    if (initial && !opened.current && listing.data) {
      opened.current = true;
      choose(listing.data.definitions.find((d) => d.id === initial));
    }
  }, [initial, listing.data, choose]);
  const connect = useCallback(async () => {
    const next = plan.current;
    if (!next) return;
    const token = generation.current;
    setBusy(true);
    try {
      const result = await post({
        ...next.body,
        attempt: ++next.attempt,
        action: "connect",
      });
      if (token !== generation.current) {
        await post({ action: "disconnect", id: result.id });
        return;
      }
      setRun(result.id);
      setStatus("connecting");
      void invalidate();
    } catch (e) {
      if (token === generation.current) {
        setStatus("error");
        toast.error((e as Error).message);
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }, [post, invalidate, setRun]);
  const ended = useCallback(
    (result: Run) => {
      void invalidate();
      const next = plan.current;
      if (next?.enabled && next.attempt < 4 && result.closeCode !== 1000) {
        setStatus("reconnecting");
        retry.current = setTimeout(
          () => void connect(),
          1000 * 2 ** (next.attempt - 1),
        );
      }
    },
    [connect, invalidate],
  );
  async function action(action: string) {
    setBusy(true);
    try {
      if (action === "connect") {
        cancel();
        plan.current = {
          body: { id: id || undefined, settings, secrets },
          attempt: 0,
          enabled: settings.reconnect,
        };
        await connect();
        return;
      }
      if (action === "disconnect") {
        cancel();
        if (status !== "reconnecting") await post({ action, id: run });
        setStatus("disconnected");
        return;
      }
      if (action === "save") {
        const saved = await post({
          action,
          id: id || undefined,
          name,
          collection,
          settings,
        });
        setId(saved.id);
        toast.success("Saved to collection");
      }
      if (action === "delete") {
        await post({ action, id });
        choose();
        toast.success("Saved connection deleted");
      }
      if (action === "ping" || action === "send")
        await post({
          action,
          id: run,
          ...(action === "send"
            ? { format: settings.format, payload: settings.draft }
            : {}),
        });
      void invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if(!access) return <p className="p-6">Checking workspace access…</p>;
  const definition=listing.data?.definitions.find(d=>d.id===id);
  const canSave=id?access.rights.editAll || (access.rights.editOwn && definition?.authorId===access.userId):access.rights.createRequests;
  const active = ["connected", "connecting", "reconnecting"].includes(status);
  return (
    <main className="ws-studio">
      <div className="ws-shell">
        <header className="ws-heading">
          <div className="ws-title-icon">
            <Radio size={23} />
          </div>
          <h1>WebSocket tester</h1>
          <span className="ws-status" data-status={status} role="status">
            <i />
            {status}
          </span>
        </header>
        {listing.isError && (
          <div className="ws-error" role="alert">
            {listing.error.message}{" "}
            <Button variant="outline" onClick={() => listing.refetch()}>
              Retry
            </Button>
          </div>
        )}
        <section className="ws-card ws-endpoint">
          <h2>
            <Cable />
            Connection
          </h2>
          <ConnectionBar
            {...{ settings, change, secrets, setSecrets }}
            control={
              <Button
                className="ws-primary"
                disabled={busy || (!active && (!settings.url || !access.rights.createRequests))}
                onClick={() => action(active ? "disconnect" : "connect")}
              >
                {active ? "Disconnect" : "Connect"}
              </Button>
            }
          />
        </section>
        <div className="ws-columns">
          <div className="ws-stack">
            <section className="ws-card">
              <h2>
                <Terminal />
                Message composer
              </h2>
              <MessageEditor
                {...{ settings, change }}
                connected={access.rights.createRequests && !busy && status === "connected"}
                send={action}
              />
            </section>
            <section className="ws-card">
              <h2>
                <Activity />
                Event timeline
              </h2>
              {run ? (
                <Timeline
                  key={run}
                  workspace={workspace}
                  runId={run}
                  onStatus={setStatus}
                  onEnd={ended}
                />
              ) : (
                <div className="ws-empty">
                  <Activity size={26} />
                  <strong>No events yet</strong>
                  <span>Connect to an endpoint or select a previous run.</span>
                </div>
              )}
            </section>
          </div>
          <aside className="ws-stack">
            <section className="ws-card">
              <h2>
                <FolderOpen />
                Collection
              </h2>{" "}
              <label>
                Saved connection{" "}
                <select
                  value={id}
                  disabled={busy}
                  onChange={(e) =>
                    choose(
                      listing.data?.definitions.find(
                        (d) => d.id === e.target.value,
                      ),
                    )
                  }
                >
                  <option value="">Unsaved connection</option>
                  {listing.data?.definitions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ws-save">
                <Input
                  placeholder="Connection name"
                  aria-label="Connection name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <select
                  aria-label="Collection"
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                >
                  <option value="">Choose collection</option>
                  {listing.data?.collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={!canSave || busy || !name || !collection}
                  onClick={() => action("save")}
                >
                  Save to collection
                </Button>
                {id && access.role==="ADMIN" && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Delete this saved connection?"))
                        void action("delete");
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </section>
            <section className="ws-card">
              <h2>
                <History />
                History
              </h2>{" "}
              <div className="ws-save">
                <label>
                  Run history{" "}
                  <select
                    value={run}
                    disabled={busy}
                    onChange={(e) => {
                      cancel();
                      setStatus("loading");
                      setRun(e.target.value);
                    }}
                  >
                    <option value="">Select run</option>
                    {run && !listing.data?.runs.some((r) => r.id === run) && (
                      <option value={run}>Selected run</option>
                    )}
                    {listing.data?.runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {new Date(r.createdAt).toLocaleString()} ·{" "}
                        {r.snapshot.url} · {r.status}
                      </option>
                    ))}
                  </select>
                </label>
                {listing.data?.runs.length === 50 && (
                  <Button
                    variant="outline"
                    onClick={() => setCursor(listing.data!.runs.at(-1)!.id)}
                  >
                    Older runs
                  </Button>
                )}
                {cursor && (
                  <Button variant="outline" onClick={() => setCursor("")}>
                    Latest runs
                  </Button>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
