"use client";

import Modal from "@/components/ui/modal";
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
      className="w-full max-w-md overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl shadow-zinc-950/10 [&_[data-slot=dialog-header]]:gap-2 [&_[data-slot=dialog-title]]:text-xl [&_[data-slot=dialog-title]]:font-semibold [&_[data-slot=dialog-description]]:leading-relaxed [&_[data-slot=dialog-footer]]:gap-3 [&_[data-slot=dialog-footer]>button:last-child]:bg-red-600 [&_[data-slot=dialog-footer]>button:last-child]:text-white [&_[data-slot=dialog-footer]>button:last-child]:shadow-sm [&_[data-slot=dialog-footer]>button:last-child]:hover:bg-red-700"
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleDelete}
      submitText={isPending ? "Deleting..." : "Delete"}
      submitVariant="destructive"
    >
      <div className="flex gap-3 rounded-xl border border-red-100 bg-red-50/80 p-4">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
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
        <p className="text-sm leading-6 text-red-900">
          Once deleted, all requests and data in this collection will be permanently removed.
        </p>
      </div>
    </Modal>
  );
};

export default DeleteCollectionModal;
