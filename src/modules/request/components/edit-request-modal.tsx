"use client";

import Modal from "@/components/ui/modal";
import { useSaveRequest } from "@/modules/request/hooks/request";
import { REST_METHOD } from "@prisma/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type RequestValues = {
  id: string;
  name: string;
  method: REST_METHOD;
  url: string;
};

export default function EditRequestModal({
  request,
  isModalOpen,
  setIsModalOpen,
}: {
  request: RequestValues;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}) {
  const [name, setName] = useState(request.name);
  const [method, setMethod] = useState(request.method);
  const [url, setUrl] = useState(request.url);
  const { mutateAsync, isPending } = useSaveRequest(request.id);

  useEffect(() => {
    if (!isModalOpen) return;
    setName(request.name);
    setMethod(request.method);
    setUrl(request.url);
  }, [isModalOpen, request]);

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) {
      toast.error("Request name and URL are required");
      return;
    }
    try {
      await mutateAsync({ name: name.trim(), method, url: url.trim() });
      toast.success("Request updated successfully");
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Failed to update request");
      console.error("Failed to update request:", error);
    }
  };

  return (
    <Modal
      title="Edit Request"
      description="Update the request name, method, and URL."
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleSubmit}
      submitText={isPending ? "Saving..." : "Save Changes"}
      submitVariant="default"
    >
      <div className="space-y-4">
        <label className="block space-y-2 text-sm font-medium text-zinc-200">
          Request name
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-zinc-200">
          Method
          <select
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
            value={method}
            onChange={(event) => setMethod(event.target.value as REST_METHOD)}
          >
            {Object.values(REST_METHOD).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium text-zinc-200">
          URL
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
