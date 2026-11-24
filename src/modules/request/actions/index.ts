"use server";

import { connectionProblem } from "../validation";
import { authorize, collectionAccess, requestAccess, writeContent } from "@/modules/workspace/access/server";
import db from "@/lib/db";
import { REST_METHOD } from "@prisma/client";
import axios, { type AxiosRequestConfig } from "axios";

export type Request = {
  name: string;
  method: REST_METHOD;
  url: string;
  body?: string;
  headers?: string;
  parameters?: string;
};

export const addRequestToCollection = async (
  collectionId: string,
  value: Request,
) => {
  const access = await collectionAccess(collectionId,"createRequests");
  return writeContent(access,"createRequests",null,"request.created",tx=>tx.request.create({
    data: {
      name: value.name,
      method: value.method,
      url: value.url,
      body: value.body,
      headers: value.headers,
      parameters: value.parameters,
      collectionId,
      authorId:access.userId,
    },
  }));
};

export const saveRequest = async(id: string, value: Request) => {
  const access=await requestAccess(id,"editRequest");
  return writeContent(access,"editRequest",access.authorId,"request.updated",tx=>tx.request.update({
    where: {
      id: id,
    },
    data: {
      name: value.name,
      method: value.method,
      url: value.url,
      body: value.body,
      headers: value.headers,
      parameters: value.parameters,
    },
  }));
};

export const deleteRequest = async (id: string) => {
  const access=await requestAccess(id,"delete");
  await writeContent(access,"delete",access.authorId,"request.deleted",tx=>tx.request.delete({where:{id}}));
};

export const getAllRequestFromCollection=async(collectionId:string)=>{
    await collectionAccess(collectionId,"view");
    const requests = await db.request.findMany({
        where:{
            collectionId:collectionId
        }
    })
    return requests;
}

type SendResult = {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: any;
  duration: number;
  size?: number | string;
  error?: string;
};

async function sendRequest(req: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
}): Promise<SendResult> {
  const config: AxiosRequestConfig = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    params: req.params,
    data: req.body,
    validateStatus: () => true, // ✅ capture errors too
  };

  const start = performance.now();
  try {
    const res = await axios(config);
    const end = performance.now();

    const duration = end - start;
    const contentLength = Number(res.headers["content-length"]);
    const size =
      Number.isFinite(contentLength) && contentLength >= 0
        ? contentLength
        : new TextEncoder().encode(JSON.stringify(res.data)).length;

    return {
      status: res.status,        
      statusText: res.statusText, 
      headers: Object.fromEntries(Object.entries(res.headers).map(([key, value]) => [key, String(value)])),
      data: res.data,            
      duration: Math.round(duration),
      size,
    };
  } catch (error: any) {
    const end = performance.now();
    return {
      error: connectionProblem(axios.isAxiosError(error) ? error.code : undefined, error instanceof Error ? error.message : String(error)),
      duration: Math.round(end - start),
    };
  }
}

function parseKeyValueConfig(value: unknown): Record<string, string> | undefined {
  if (!value) return undefined;

  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }

  if (Array.isArray(parsed)) {
    const entries = parsed
      .filter((item) => item && item.enabled !== false && item.key)
      .map((item) => [String(item.key), String(item.value ?? "")]);
    return Object.fromEntries(entries);
  }

  if (typeof parsed === "object") {
    return parsed as Record<string, string>;
  }

  return undefined;
}

export async function run(requestData: {
  workspaceId: string;
  requestId?: string;
  method: string;
  url: string;
  headers?: unknown;
  parameters?: unknown;
  body?: unknown;
}) {
  const check = async () => {
    if (!requestData.requestId) return authorize(requestData.workspaceId, "createRequests");
    const access = await requestAccess(requestData.requestId, "editRequest");
    if (access.workspaceId !== requestData.workspaceId) throw new Error("Workspace access denied");
    return access;
  };
  await check();
  try {
    const requestConfig = {
      method: requestData.method,
      url: requestData.url,
      headers: parseKeyValueConfig(requestData.headers),
      params: parseKeyValueConfig(requestData.parameters),
      body: requestData.body || undefined,
    };

    const result = await sendRequest(requestConfig);
    await check();
    const status = result.status ?? 0;
    const statusText = result.statusText ?? (result.error ? "Error" : "");
    const body = result.data ?? result.error ?? null;
    const runData = {
      status,
      statusText,
      headers: result.headers ?? {},
      body,
      durationMs: result.duration ?? 0,
    };

    const requestId = requestData.requestId;
    const requestRun = requestId
      ? await persistRun(requestId, result, runData)
      : { id: "unsaved", ...runData, createdAt: new Date() };

    return {
      success: !result.error,
      ...(result.error ? { error: result.error } : {}),
      requestRun,
      result
    };

  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
      requestRun: {
        id: "failed",
        status: 0,
        statusText: "Failed",
        headers: {},
        body: message,
        durationMs: 0,
      },
      result: { status: 0, statusText: "Failed", data: message, duration: 0 },
    };
  }
}


async function persistRun(requestId:string, result:SendResult, data: Omit<import("@prisma/client").Prisma.RequestRunUncheckedCreateInput,"requestId">) {
  const access=await requestAccess(requestId,"editRequest");
  return writeContent(access,"editRequest",access.authorId,"request.executed",async tx=>{
    const run=await tx.requestRun.create({data:{...data,requestId}});
    if(!result.error && result.data!==undefined) await tx.request.update({where:{id:requestId},data:{response:result.data}});
    return run;
  });
}
export async function runDirect(requestData: {
  id: string; method: string; url: string; headers?: Record<string,string>;
  parameters?: Record<string,string>; body?: unknown;
}) {
  const access=await requestAccess(requestData.id,"editRequest");
  return run({...requestData,workspaceId:access.workspaceId,requestId:requestData.id});
}
