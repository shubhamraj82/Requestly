"use client";

import Modal from "@/components/ui/modal";
import styles from "@/components/ui/workspace-dialog.module.css";
import { useDeleteCollections } from "../hooks/collection";
import React from "react";
import { toast } from "sonner";

const DeleteCollectionModal = ({
  isModalOpen,
  setIsModalOpen,
  collectionId,
}: {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  collectionId: string;
}) => {
  const { mutateAsync, isPending } = useDeleteCollections(collectionId);

  const handleDelete = async () => {
    try {
      await mutateAsync();
      toast.success("Collection deleted successfully");
      setIsModalOpen(false);
    } catch (err) {
      toast.error("Failed to delete collection");
      console.error("Failed to delete collection:", err);
    }
  };

  return (
    <Modal
      title="Delete Collection"
      description="Are you sure you want to delete this collection? This action cannot be undone."
      className={`${styles.dialog} ${styles.danger}`}
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleDelete}
      submitText={isPending ? "Deleting..." : "Delete"}
      submitVariant="destructive"
    >
      <div className="flex gap-3 rounded-xl border border-rose-400/25 bg-rose-400/8 p-4">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-400/15 text-rose-300">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="size-[18px]"
          >
            <path
              d="M12 8v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-sm leading-6 text-rose-100">
          Once deleted, all requests and data in this collection will be
          permanently removed.
        </p>
      </div>
    </Modal>
  );
};

export default DeleteCollectionModal;
