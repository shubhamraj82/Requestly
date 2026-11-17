"use client";

import Modal from "@/components/ui/modal";
import { useDeleteRequest } from "@/modules/request/hooks/request";
import { toast } from "sonner";

export default function DeleteRequestModal({
  requestId,
  requestName,
  collectionId,
  isModalOpen,
  setIsModalOpen,
}: {
  requestId: string;
  requestName: string;
  collectionId: string;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}) {
  const { mutateAsync, isPending } = useDeleteRequest(requestId, collectionId);

  const handleDelete = async () => {
    try {
      await mutateAsync();
      toast.success("Request deleted successfully");
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Failed to delete request");
      console.error("Failed to delete request:", error);
    }
  };

  return (
    <Modal
      title="Delete Request"
      description={`Are you sure you want to delete “${requestName}”? This action cannot be undone.`}
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleDelete}
      submitText={isPending ? "Deleting..." : "Delete"}
      submitVariant="destructive"
    >
      <p className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">
        This request will be permanently removed from its collection.
      </p>
    </Modal>
  );
}
