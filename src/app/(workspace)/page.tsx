"use client"

import {ResizableHandle,ResizablePanelGroup,ResizablePanel} from "@/components/ui/resizable"
import { useWorkspaceStore } from "@/modules/layout/store"
import {useGetWorkspace} from "@/modules/workspace/hooks/workspace"
import {Loader} from "lucide-react"
import TabbedSidebar from "@/modules/collections/components/sidebar"

const Page=()=>{
  const {selectedWorkspace}=useWorkspaceStore();
 
  const {data:currentWorkspace,isPending}= useGetWorkspace(selectedWorkspace?.id||"");

  if(isPending){
    return(
      <div className="flex flex-col items-center justify-center h-full">
        <Loader className="animate-spin h-6 w-6 text-indigo-500"/>
      </div>
    )
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0">
      <ResizablePanel defaultSize="65%" minSize="40%">
        <h1>Request playground</h1>
      </ResizablePanel>
      <ResizableHandle withHandle/>

      <ResizablePanel defaultSize="35%" maxSize="40%" minSize="25%" className="flex min-w-0">
        <div className="flex-1">
          <TabbedSidebar currentWorkspace={currentWorkspace!}    />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default Page
