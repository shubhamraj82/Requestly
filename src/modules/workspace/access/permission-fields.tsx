import { Switch } from "@/components/ui/switch";
import {
  labels,
  type Permissions,
  type Role,
  type Capability,
} from "./permissions";
export const fieldStyle =
  "h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 text-sm text-zinc-100";
export function PermissionFields({
  role,
  value,
  change,
}: {
  role: Role;
  value: Permissions;
  change: (v: Permissions) => void;
}) {
  return (
    <div className="grid gap-x-5 sm:grid-cols-2">
      {(Object.keys(labels) as Capability[]).map((key) => (
        <label
          key={key}
          className="flex items-center justify-between gap-3 border-b border-zinc-800 py-2.5 text-sm"
        >
          {labels[key]}
          <Switch
            size="sm"
            aria-label={labels[key]}
            checked={value[key]}
            disabled={
              (key === "manage" && role !== "ADMIN") ||
              (key === "invite" && role === "MEMBER")
            }
            onCheckedChange={(on) => change({ ...value, [key]: on })}
          />
        </label>
      ))}
    </div>
  );
}
