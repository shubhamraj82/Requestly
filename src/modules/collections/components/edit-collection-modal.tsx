"use client";

import Modal from "@/components/ui/modal";
import styles from "@/components/ui/workspace-dialog.module.css";
import { useUpdateCollection } from "../hooks/collection";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  collectionId: string;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  initialName: string;
}

const EditCollectionModal = ({
  collectionId,
  isModalOpen,
  setIsModalOpen,
  initialName,
}: Props) => {
  const [name, setName] = useState(initialName);
  const { isPending, mutateAsync } = useUpdateCollection(collectionId, name);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      await mutateAsync();
      toast.success("Collection updated successfully");
      setIsModalOpen(false);
    } catch (err) {
      toast.error("Failed to update collection");
      console.log("Failed to update collection", err);
    }
  };

  return (
    <Modal
      title="Edit Collection"
      description="Rename your collection"
      className={styles.dialog}
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleSubmit}
      submitText={isPending ? "Saving..." : "Save Changes"}
      submitVariant="default"
    >
      <div className="space-y-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="size-[18px]"
            >
              <path
                d="m16.86 4.49 2.65 2.65M4 20l4.1-.82L19.1 8.18a1.88 1.88 0 0 0-2.65-2.65L5.45 16.53 4 20Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <input
            className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-11 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50"
            placeholder="Collection name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};

export default EditCollectionModal;
