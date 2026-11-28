import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ChevronDown, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { advanceSession, describeSession, type SessionState } from "../explain-session";
import { api, endpoint, type Entry } from "../hooks/useWs";

export function eventId(run: string, seq: number) {
  return `ws-event-${run}-${seq}`;
}

type Props = {
  workspace: string;
  runId: string;
  events: Entry[];
  jump: (seq: number) => void;
};

function LiveFindings({ workspace, runId, events, jump }: Props) {
  const latest = events.at(-1)!.seq;
  const [boundary, setBoundary] = useState(latest);
  const [live, setLive] = useState<SessionState>();
  const history = useQuery({
    queryKey: ["session-explanation", workspace, runId, boundary],
    queryFn: () => api<SessionState>(endpoint(workspace, { run: runId, explain: String(boundary), live: "1" })),
    staleTime: Infinity,
    retry: false,
  });
  const state = live ?? history.data;
  if (state && state.through < latest) {
    const pending = events.filter(row => row.seq > state.through);
    if (pending[0].seq === state.through + 1) {
      setLive(advanceSession(state, pending));
    } else {
      // History loaded after the first new frame had already left the timeline buffer.
      setLive(undefined);
      setBoundary(latest);
    }
  }
  if (history.isError) return <>
    <p role="alert">{history.error.message}</p>
    <Button size="sm" variant="outline" disabled={history.isFetching} onClick={() => void history.refetch()}>
      Retry explanation
    </Button>
  </>;
  if (!state) return <p role="status">Reading session history…</p>;
  const result = describeSession(state);
  return <>
    <p>Through log #{result.through}</p>
    <ol>
      {result.observations.map((item, index) => (
        <li key={index} data-attention={item.attention || undefined}>
          <span>{item.text}</span>
          <a href={`#${eventId(runId, item.seq)}`} aria-label={`Go to log entry ${item.seq}: ${item.text}`}
            onClick={event => { event.preventDefault(); jump(item.seq); }}>
            <ArrowDownLeft size={13} aria-hidden="true" /> #{item.seq}
          </a>
        </li>
      ))}
    </ol>
  </>;
}

export function ExplainSession(props: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="ws-explain">
      <Button variant="ghost" disabled={!props.events.length} aria-controls={id} aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <ListTree aria-hidden="true" /> Explain this session <ChevronDown aria-hidden="true" />
      </Button>
      <div id={id} hidden={!open} className="ws-findings">
        {open && props.events.length > 0 && <LiveFindings {...props} />}
      </div>
    </div>
  );
}
