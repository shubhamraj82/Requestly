import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RestResponseChanges } from "@/modules/comparison/response-changes";
import Editor from "@monaco-editor/react";
import {
  Clock,
  HardDrive,
  CheckCircle,
  Copy,
  Download,
  Filter,
  MoreHorizontal,
  Code,
  FileText,
  Settings,
  TestTube,
} from "lucide-react";

type HeadersMap = Record<string, string>;

interface RequestRun {
  id: string;
  requestId?: string;
  status?: number;
  statusText?: string;
  headers?: HeadersMap;
  body?: string | object | null;
  durationMs?: number;
  createdAt?: string;
}

interface Result {
  status?: number;
  statusText?: string;
  duration?: number;
  size?: number;
}

export interface ResponseData {
  success: boolean;
  comparisonScope?: string;
  // A run can be missing when the request fails before it is persisted.
  requestRun?: RequestRun;
  result?: Result;
}

interface Props {
  responseData: ResponseData;
}

const ResponseViewer = ({ responseData }: Props) => {
  const [activeTab, setActiveTab] = useState("json");
  const requestRun = responseData?.requestRun;
  const responseHeaders = requestRun?.headers ?? {};

  const getStatusColor = (status?: number): string => {
    const s = typeof status === "number" ? status : 0;
    if (s >= 200 && s < 300) return "text-green-400";
    if (s >= 300 && s < 400) return "text-yellow-400";
    if (s >= 400 && s < 500) return "text-orange-400";
    if (s >= 500) return "text-red-400";
    return "text-gray-400";
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const copyToClipboard = (text: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text).catch(() => {
      /* ignore */
    });
  };

  // Defensive parse: body may be already an object or invalid JSON
  let responseBody: unknown = {};
  let formattedJsonString = "";
  try {
    const rawBody = requestRun?.body;
    if (typeof rawBody === "string") {
      responseBody = rawBody.length ? JSON.parse(rawBody) : rawBody;
    } else {
      responseBody = rawBody ?? {};
    }
    formattedJsonString = JSON.stringify(responseBody, null, 2);
  } catch {
    // If parsing fails, fall back to the raw string
    responseBody = requestRun?.body ?? {};
    formattedJsonString =
      typeof responseBody === "string"
        ? responseBody
        : JSON.stringify(responseBody, null, 2);
  }

  const status: number | undefined =
    responseData?.result?.status ?? requestRun?.status;
  const statusText: string | undefined =
    responseData?.result?.statusText ?? requestRun?.statusText;
  const duration: number | undefined =
    responseData?.result?.duration ?? requestRun?.durationMs;
  const size: number | undefined = responseData?.result?.size;
  const rawBody = requestRun?.body;
  const rawText = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody) ?? "";

  const failed = status === 0 || (status !== undefined && status >= 400);
  const errorFields = responseBody && typeof responseBody === "object"
    ? responseBody as Record<string, unknown> : {};
  const apiMessage = [errorFields.detail, errorFields.message, errorFields.error, errorFields.title]
    .find((value): value is string => typeof value === "string" && !!value.trim());
  const statusHints: Record<number, string> = {
    400: "Check the request parameters and body against the API’s requirements.",
    401: "Check the authentication credentials for this endpoint.",
    403: "Check whether your credentials have permission for this endpoint.",
    404: "Check the endpoint path and any resource ID in the URL.",
    405: "Check which HTTP methods this endpoint accepts.",
    415: "Check that the Content-Type header matches the body format.",
    422: "Check the required fields, types, and values in your request.",
    429: "Check the response headers for a retry interval.",
  };
  const errorDetail = apiMessage || (typeof responseBody === "string" && !responseBody.trimStart().startsWith("<") ? responseBody : "");
  const errorHeading = status ? `HTTP ${status} ${statusText ?? ""}`.trim() : "No HTTP response";
  return (
    <div className="rest-result w-full text-white" role="region" aria-label="Response details" tabIndex={0}>

        {failed && (
          <div role="status" className="space-y-1 rounded-lg border border-rose-400/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
            <strong>{errorHeading}</strong>
            {errorDetail && <p className="whitespace-pre-wrap wrap-anywhere">{errorDetail.length > 500 ? errorDetail.slice(0, 500) + "…" : errorDetail}</p>}
            {!!status && <p>{statusHints[status] ?? (status >= 500 ? "The server reported an error. Check its response body for details." : "Check the server’s response body for details.")}</p>}
          </div>
        )}
        {/* Status Header */}
        <Card className="bg-zinc-900 border-zinc-800 shrink-0 py-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Status:</span>
                  <Badge
                    className={`${getStatusColor(
                      status,
                    )} bg-transparent border-current`}
                  >
                    {status ?? "—"} • {statusText ?? ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Time:</span>
                  <span className="text-blue-300">
                    {duration ? `${duration} ms` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Size:</span>
                  <span className="text-green-300">{formatBytes(size)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Response Tabs */}
        <Card className="rest-response-tabs bg-zinc-900 border-zinc-800 py-0">
          <CardContent className="p-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="px-6 border-b border-zinc-800">
                <TabsList className="bg-transparent p-0 h-auto">
                  <TabsTrigger
                    value="json"
                    className="bg-transparent data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-gray-400 rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-500 px-4 py-2"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    JSON
                  </TabsTrigger>
                  <TabsTrigger
                    value="raw"
                    className="bg-transparent data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-gray-400 rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-500 px-4 py-2"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Raw
                  </TabsTrigger>
                  <TabsTrigger
                    value="headers"
                    className="bg-transparent data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-gray-400 rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-500 px-4 py-2"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Headers
                    <Badge
                      variant="secondary"
                      className="ml-2 text-xs bg-zinc-700"
                    >
                      {Object.keys(responseHeaders).length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="test"
                    className="bg-transparent data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-gray-400 rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-500 px-4 py-2"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    Test Results
                  </TabsTrigger>
                  {responseData.comparisonScope && <TabsTrigger value="changes" className="px-4 py-2 text-gray-400">What changed?</TabsTrigger>}
                </TabsList>
              </div>

              {responseData.comparisonScope && requestRun && <TabsContent value="changes" className="mt-0 overflow-auto">
                <RestResponseChanges key={responseData.comparisonScope} scope={responseData.comparisonScope} current={{
                  body: requestRun.body, status, label: requestRun.createdAt
                    ? new Date(requestRun.createdAt).toLocaleTimeString(undefined, { fractionalSecondDigits: 3, hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : "Request failed",
                }} />
              </TabsContent>}
              {(["json", "raw"] as const).map((view) => {
                const text = view === "json" ? formattedJsonString : rawText;
                return (
                  <TabsContent key={view} value={view} className="mt-0 min-w-0">
                    <div className="relative h-full">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-4 z-10 bg-zinc-800 text-gray-400 hover:text-white"
                        aria-label="Copy response body"
                        onClick={() => copyToClipboard(text)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Editor
                        height="100%"
                        defaultLanguage={view === "json" ? "json" : "plaintext"}
                        value={text}
                        loading={
                          <pre
                            tabIndex={0}
                            aria-label="Response body"
                            className="h-full w-full overflow-auto whitespace-pre-wrap wrap-anywhere p-3 pr-16 font-mono text-sm"
                          >
                            {text}
                          </pre>
                        }
                        options={{
                          readOnly: true,
                          automaticLayout: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 14,
                          wordWrap: "on",
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          lineNumbers: "on",
                          glyphMargin: false,
                          folding: true,
                          lineDecorationsWidth: 0,
                          lineNumbersMinChars: 3,
                          renderLineHighlight: "none",
                          scrollbar: {
                            vertical: "visible",
                            horizontal: "auto",
                            alwaysConsumeMouseWheel: false,
                          },
                        }}
                        theme="vs-dark"
                      />
                    </div>
                  </TabsContent>
                );
              })}

              <TabsContent value="headers" className="mt-0">
                <ScrollArea className="h-full">
                  <div className="p-6">
                    <div className="space-y-3">
                      {Object.entries(responseHeaders).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-start justify-between py-2 border-b border-zinc-800 last:border-b-0"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-blue-300 text-sm">
                              {key}
                            </div>
                            <div className="text-gray-300 text-sm break-all">
                              {value}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-white ml-2"
                            onClick={() => copyToClipboard(`${key}: ${value}`)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="test" className="mt-0">
                {failed ? <p className="p-6 text-rose-200">{errorHeading}. The request did not pass the status check.</p> : <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">
                      All tests passed
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                      <span className="text-gray-300">Status code is 200</span>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                      <span className="text-gray-300">
                        Response time is less than 3000ms
                      </span>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                      <span className="text-gray-300">
                        Content-Type is present
                      </span>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                  </div>
                </div>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
    </div>
  );
};

export default ResponseViewer;
