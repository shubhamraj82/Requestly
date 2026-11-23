import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Settings } from "../settings";
export default function MessageEditor({
  settings,
  change,
  connected,
  send,
}: {
  settings: Settings;
  change: (s: Settings) => void;
  connected: boolean;
  send: (command: string) => void;
}) {
  return (
    <section className="space-y-2">
      <label>
        Message format{" "}
        <select
          value={settings.format}
          onChange={(e) =>
            change({
              ...settings,
              format: e.target.value as Settings["format"],
            })
          }
        >
          <option value="text">Text</option>
          <option value="json">JSON</option>
          <option value="binary">Binary (base64)</option>
        </select>
      </label>
      <Textarea
        aria-label="Message payload"
        value={settings.draft}
        onChange={(e) => change({ ...settings, draft: e.target.value })}
        placeholder={
          settings.format === "json"
            ? '{"message": "hello"}'
            : settings.format === "binary"
              ? "Enter base64 data"
              : "Write a message…"
        }
        className="ws-payload font-mono"
      />
      <div className="flex gap-2">
        <Button
          className="ws-primary"
          disabled={!connected}
          onClick={() => send("send")}
        >
          Send message
        </Button>
        <Button
          variant="outline"
          disabled={!connected}
          onClick={() => send("ping")}
        >
          Ping
        </Button>
      </div>
    </section>
  );
}
