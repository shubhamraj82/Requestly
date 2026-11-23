import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export interface Confirmation {
  title: string;
  detail: string;
  confirmLabel: string;
  match?: string;
}
export function ConfirmChange({
  confirmation,
  finish,
}: {
  confirmation: Confirmation;
  finish: (ok: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) finish(false);
      }}
    >
      <AlertDialogContent className="bg-zinc-900 text-zinc-100">
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmation.detail}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmation.match && (
          <label className="grid gap-2 text-sm">
            Enter {confirmation.match} to confirm
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            disabled={!!confirmation.match && typed !== confirmation.match}
            onClick={() => finish(true)}
          >
            {confirmation.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
