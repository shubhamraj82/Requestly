"use client";

import { useHotkeys } from "react-hotkeys-hook";
import RequestEditor from "./request-editor";
import TabBar from "./tab-bar";
import { useRequestPlaygroundStore } from "../store/useRequestStore";
import { useState } from "react";
import { toast } from "sonner";
import { REST_METHOD } from "@prisma/client";

import { ArrowRight, Braces } from "lucide-react";
import { useSaveRequest } from "../hooks/request";
import SaveRequestToCollectionModal from "@/modules/collections/components/add-request-modal";

export default function PlaygroundPage() {
  const { tabs, activeTabId, addTab } = useRequestPlaygroundStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const {mutateAsync, isPending} = useSaveRequest(activeTab?.requestId!);
  const [showSaveModal, setShowSaveModal] = useState(false);


  const getCurrentRequestData = () => {
    if (!activeTab) {
      return {
        name: "Untitled Request",
        method: REST_METHOD.GET as REST_METHOD,
        url: "https://echo.hoppscotch.io"
      };
    }

    return {
      name: activeTab.title || "Untitled Request",
      method: (activeTab.method as REST_METHOD) || REST_METHOD.GET,
      url: activeTab.url || "https://echo.hoppscotch.io"
    };
  };

 useHotkeys(
  "ctrl+s, meta+s",
  async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!activeTab) {
      toast.error("No active request to save");
      return;
    }

    if (activeTab.collectionId) {
  
      try {
        await mutateAsync({
          url: activeTab.url || "https://echo.hoppscotch.io",
          method: activeTab.method as REST_METHOD,
          name: activeTab.title || "Untitled Request",
          body: activeTab.body,
          headers: activeTab.headers,
          parameters: activeTab.parameters,
          
        });
        toast.success("Request updated");
      } catch (err) {
        console.error("Failed to update request:", err);
        toast.error("Failed to update request");
      }
    } else {
     
      setShowSaveModal(true);
    }
  },
  { preventDefault: true, enableOnFormTags: true },
  [activeTab]
);


  useHotkeys(
    "ctrl+g, meta+shift+n",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      addTab();
      toast.success("New request created");
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
    },
    []
  );

  if (!activeTab) {
    return (
      <div className="rest-welcome">
        <section className="rest-start-card" aria-labelledby="rest-start-title">
          <div className="rest-start-intro">
            <h1 id="rest-start-title">REST workspace</h1>
            <p>Enter an endpoint to start a request, or open one from Collections.</p>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            const endpoint = new FormData(event.currentTarget).get("endpoint");
            addTab(typeof endpoint === "string" ? endpoint.trim() : "");
          }}>
            <label htmlFor="rest-start-url">Request URL</label>
            <div className="rest-start-endpoint">
              <span>GET</span>
              <input id="rest-start-url" name="endpoint" type="text" inputMode="url"
                autoCapitalize="none" spellCheck={false} placeholder="https://api.example.com" />
            </div>
            <div className="rest-start-actions">
              <button type="submit" className="rest-action">New request <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="rest-playground flex flex-col h-full">
      <header className="rest-heading"><Braces className="rest-mark" aria-hidden="true"/><h1>REST API tester</h1></header>
      <TabBar />
      <div className="flex-1 overflow-auto">
        <RequestEditor />
      </div>

      {/* Save Request Modal */}
      <SaveRequestToCollectionModal
        isModalOpen={showSaveModal}
        setIsModalOpen={setShowSaveModal}
        requestData={getCurrentRequestData()}
        initialName={getCurrentRequestData().name}
      />
    </div>
  );
}