"use client";

import Modal from "@/components/ui/modal";
import styles from "@/components/ui/workspace-dialog.module.css";
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
      className={`${styles.dialog} ${styles.danger} wrap-anywhere`}
      title="Delete Request"
      description={`Are you sure you want to delete “${requestName}”? This action cannot be undone.`}
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleDelete}
      submitText={isPending ? "Deleting..." : "Delete"}
      submitVariant="destructive"
    >
      <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-4 text-sm leading-6 text-rose-100">
        This request will be permanently removed from its collection.
      </p>
    </Modal>
  );
}
