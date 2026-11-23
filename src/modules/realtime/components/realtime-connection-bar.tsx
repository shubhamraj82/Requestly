import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Settings } from "../settings";

export default function ConnectionBar({
  settings,
  change,
  secrets,
  setSecrets,
  control,
}: {
  control: React.ReactNode;
  settings: Settings;
  change: (s: Settings) => void;
  secrets: Record<string, string>;
  setSecrets: (s: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="ws-url">
        <Input
          aria-label="WebSocket URL"
          placeholder="wss://example.com/socket"
          value={settings.url}
          onChange={(e) => change({ ...settings, url: e.target.value })}
        />
        {control}
      </div>
      <details className="ws-handshake">
        <summary className="cursor-pointer">Handshake settings</summary>
        {(["parameters", "headers"] as const).map((field) => (
          <fieldset key={field} className="space-y-2 py-2">
            <legend className="capitalize">{field}</legend>
            {settings[field].map((pair, i) => {
              const update = (patch: Partial<typeof pair>) =>
                change({
                  ...settings,
                  [field]: settings[field].map((p, j) =>
                    i === j ? { ...p, ...patch } : p,
                  ),
                });
              return (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    aria-label="Enabled"
                    type="checkbox"
                    checked={pair.enabled}
                    onChange={(e) => update({ enabled: e.target.checked })}
                  />
                  <Input
                    aria-label="Key"
                    placeholder="Key"
                    value={pair.key}
                    onChange={(e) => update({ key: e.target.value })}
                  />
                  <Input
                    aria-label="Value"
                    placeholder={
                      field === "headers" ? "Value or {{secret}}" : "Value"
                    }
                    value={pair.value}
                    onChange={(e) => update({ value: e.target.value })}
                  />
                  {pair.value === "{{secret}}" && (
                    <Input
                      aria-label="Runtime secret"
                      placeholder="Runtime secret"
                      type="password"
                      value={secrets[pair.key] || ""}
                      onChange={(e) =>
                        setSecrets({ ...secrets, [pair.key]: e.target.value })
                      }
                    />
                  )}
                  <Button
                    variant="ghost"
                    onClick={() =>
                      change({
                        ...settings,
                        [field]: settings[field].filter((_, j) => i !== j),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
            <Button
              variant="outline"
              onClick={() =>
                change({
                  ...settings,
                  [field]: [
                    ...settings[field],
                    { key: "", value: "", enabled: true },
                  ],
                })
              }
            >
              Add {field === "headers" ? "header" : "parameter"}
            </Button>
          </fieldset>
        ))}
        <label>
          Subprotocols (comma separated)
          <Input
            value={settings.protocols.join(",")}
            onChange={(e) =>
              change({
                ...settings,
                protocols: e.target.value
                  ? e.target.value.split(",").map((x) => x.trim())
                  : [],
              })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.reconnect}
            onChange={(e) =>
              change({ ...settings, reconnect: e.target.checked })
            }
          />{" "}
          Retry unexpected disconnects (up to 3 times)
        </label>
      </details>
    </div>
  );
}
