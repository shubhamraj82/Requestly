"use client";

import { Input } from "@/components/ui/input";
import Modal from "@/components/ui/modal";
import { useState } from "react";
import {useCreateCollections} from "@/modules/collections/hooks/collection";
import { toast } from "sonner";

interface Props{
    workspaceId:string;
    isModalOpen:boolean;
    setIsModalOpen:(isOpen:boolean)=>void;
}

const CreateCollection = ({workspaceId,isModalOpen,setIsModalOpen}:Props) => {

    const [name,setName]=useState("");
    const {isPending,mutateAsync} = useCreateCollections(workspaceId, name);

    const handleSubmit =async ()=>{
        if(!name.trim()){
            return;
        }
        try{
            await mutateAsync();
            toast.success("Collection created successfully");
      setName("");
      setIsModalOpen(false);
    } catch (err) {
      toast.error("Failed to create Collection");
      console.error("Failed to create Collection:", err);
    }
  };

  return (
    <Modal
    title="Add New Collection"
    description="Create a new collection to organize your requests."
    isOpen={isModalOpen}
    onClose={()=>setIsModalOpen(false)}
    onSubmit={handleSubmit}
    submitText={isPending?"Creating....":"Collection created"}
    submitVariant="default"
    >
        <div className="space-y-4">
            <Input
            className="w-full p-2 border rounded"
            placeholder="Collection Name"
            value={name}
            onChange={(e)=>setName(e.target.value)} 
            />
        </div>
    </Modal>
  )
}

export default CreateCollection
