import React, { useState } from "react";
import { urlProblem, jsonProblem, mediaType, isJsonType, withContentType } from "../validation";
import { RequestTab } from "../store/useRequestStore";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useRunRequest } from "../hooks/request";
import { toast } from "sonner";

interface Props {
  editable:boolean;
  tab: RequestTab;
  updateTab: (id: string, data: Partial<RequestTab>) => void;
}

const RequestBar = ({ tab, updateTab,editable }: Props) => {
  const { mutateAsync, isPending } = useRunRequest();
  const [attempted, setAttempted] = useState(false);
  const urlError = urlProblem(tab.url);
  const type = mediaType(tab.headers);
  const bodyError = isJsonType(type) && jsonProblem(tab.body ?? "");
  const requestColorMap: Record<string, string> = {
    GET: "text-green-500",
    POST: "text-blue-500",
    PUT: "text-yellow-500",
    DELETE: "text-red-500",
  };

  const onSendRequest = async () => {
    setAttempted(true);
    if (urlError || bodyError) return;
    try {
      const res = await mutateAsync({
        requestId: tab.requestId,
        method: tab.method,
        url: tab.url.trim(),
        headers: tab.body && !type ? withContentType(tab.headers, "application/json") : tab.headers,
        parameters: tab.parameters,
        body: tab.body,
      });

      if ((res.result?.status ?? 0) >= 400) {
        toast.error(`HTTP ${res.result.status} ${res.result.statusText ?? ""}. See the response body for details.`);
      } else if (res.success) {
        toast.success("Request sent successfully!");
      } else {
        toast.error(res.error || "Request failed.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send request.");
    }
  };

  return (
    <>
    <div className="rest-url flex flex-row items-center gap-2 w-full">
      <div className="flex flex-row items-center gap-2 flex-1 min-w-0">
        <Select disabled={!editable}
          value={tab.method}
          onValueChange={(value) => updateTab(tab.id, { method: value })}
        >
          <SelectTrigger
            className={`w-24 ${requestColorMap[tab.method] || "text-gray-500"}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="GET" className="text-green-500">
                GET
              </SelectItem>
              <SelectItem value="POST" className="text-blue-500">
                POST
              </SelectItem>
              <SelectItem value="PUT" className="text-yellow-500">
                PUT
              </SelectItem>
              <SelectItem value="DELETE" className="text-red-500">
                DELETE
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Input
          readOnly={!editable}
          value={tab.url || ""}
          onChange={(e) => updateTab(tab.id, { url: e.target.value })}
          aria-invalid={attempted && !!urlError}
          aria-describedby={attempted && urlError ? "request-url-error" : undefined}
          placeholder="Enter URL"
          aria-label="Request URL" className="flex-1 min-w-0 font-mono"
        />
      </div>

      <Button
        type="submit"
        onClick={onSendRequest}
        disabled={!editable || isPending}
        className="rest-action"
      >
        <Send size={15} />
        Send
      </Button>
    </div>
    {attempted && urlError && <p id="request-url-error" role="alert" className="mt-2 text-sm text-rose-300">{urlError}</p>}
    {attempted && bodyError && <p role="alert" className="mt-2 text-sm text-rose-300">Check the Body tab. {bodyError}</p>}
    </>
  );
};

export default RequestBar;
