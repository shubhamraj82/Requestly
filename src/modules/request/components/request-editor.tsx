"use client";

import { useRequestPlaygroundStore } from "../store/useRequestStore";
import RequestBar from "./request-bar";
import RequestEditorArea from "./request-editor-area";
import ResponseViewer from "./response-viewer";


export default function RequestEditor({editable}:{editable:boolean}) {
  const { tabs, activeTabId, updateTab ,responseViewerData

  } = useRequestPlaygroundStore();
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  if (!activeTab) return null;

  return (
    <div className="rest-editor" data-has-response={Boolean(responseViewerData)}>
      <section className="rest-card">
        <h2>Request</h2>
        <RequestBar editable={editable} tab={activeTab} updateTab={updateTab} />
        <RequestEditorArea editable={editable} tab={activeTab} updateTab={updateTab} />
      </section>
      <section className="rest-card rest-response">
        <h2>{responseViewerData ? "Response Body" : "Response"}</h2>
        {responseViewerData ? <ResponseViewer responseData={responseViewerData} /> : (
          <p className="rest-response-empty">Send the request to see its response.</p>
        )}
      </section>
    </div>
  );
}
