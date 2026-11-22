"use server";

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
  const request = await db.request.create({
    data: {
      name: value.name,
      method: value.method,
      url: value.url,
      body: value.body,
      headers: value.headers,
      parameters: value.parameters,
      collectionId,
    },
  });
  return request;
};

export const saveRequest = async(id: string, value: Request) => {
  const request = await db.request.update({
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
  });
  return request;
};

export const deleteRequest = async (id: string) => {
  await db.request.delete({ where: { id } });
};

export const getAllRequestFromCollection=async(collectionId:string)=>{
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

export async function sendRequest(req: {
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
    const size =
      res.headers["content-length"] ||
      new TextEncoder().encode(JSON.stringify(res.data)).length;

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
      error: error instanceof Error ? error.message : String(error),
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
  requestId?: string;
  method: string;
  url: string;
  headers?: unknown;
  parameters?: unknown;
  body?: unknown;
}) {
  try {
    const requestConfig = {
      method: requestData.method,
      url: requestData.url,
      headers: parseKeyValueConfig(requestData.headers),
      params: parseKeyValueConfig(requestData.parameters),
      body: requestData.body || undefined,
    };

    const result = await sendRequest(requestConfig);
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

    const requestRun = requestData.requestId
      ? await db.requestRun.create({
          data: { requestId: requestData.requestId, ...runData },
        })
      : { id: "unsaved", ...runData, createdAt: new Date() };

    if (requestData.requestId && !result.error && result.data !== undefined) {
      await db.request.update({
        where: { id: requestData.requestId },
        data: { response: result.data, updatedAt: new Date() },
      });
    }

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


export async function runDirect(requestData: {
  id: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  parameters?: Record<string, any>;
  body?: any;
}) {
  try {
    const requestConfig = {
      method: requestData.method,
      url: requestData.url,
      headers: requestData.headers,
      params: requestData.parameters,
      body: requestData.body
    };

    const result = await sendRequest(requestConfig);

    const requestRun = await db.requestRun.create({
      data: {
        requestId: requestData.id,
        status: result.status || 0,
        statusText: result.statusText || (result.error ? 'Error' : null),
        headers: result.headers || "",
        body: result.data ? (typeof result.data === 'string' ? result.data : JSON.stringify(result.data)) : null,
        durationMs: result.duration || 0
      }
    });

    // Update request with latest response if successful
    if (result.data && !result.error) {
      await db.request.update({
        where: { id: requestData.id },
        data: {
          response: result.data,
          updatedAt: new Date()
        }
      });
    }

    return {
      success: true,
      requestRun,
      result
    };

  } catch (error: any) {
    const failedRun = await db.requestRun.create({
      data: {
        requestId: requestData.id,
        status: 0,
        statusText: 'Failed',
        headers: "",
        body: error.message,
        durationMs: 0
      }
    });

    return {
      success: false,
      error: error.message,
      requestRun: failedRun
    };
  }
}
