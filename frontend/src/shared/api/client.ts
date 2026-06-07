import axios, { type AxiosRequestConfig } from "axios";
import type { StreamDonePayload, Message } from "@/shared/types";

export const BASE_URL = "/api";

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : error.message || "请求失败";
    return Promise.reject(new Error(message));
  }
);

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config);
  return response.data;
}

export interface StreamHandlers {
  onUserMessage?: (msg: Message) => void;
  onStatus?: (text: string) => void;
  onDelta: (delta: string) => void;
  onDone: (payload: StreamDonePayload) => void;
  onError: (message: string) => void;
}

export interface StreamOptions {
  signal?: AbortSignal;
}

function parseSSEBlock(block: string): { event: string; data: string } | null {
  const lines = block.trim().split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data = line.slice(5).trim();
  }
  return data ? { event, data } : null;
}

function dispatchSSEEvent(
  event: string,
  payload: unknown,
  handlers: StreamHandlers
): void {
  switch (event) {
    case "user_message":
      handlers.onUserMessage?.(payload as Message);
      break;
    case "status":
      handlers.onStatus?.((payload as { text: string }).text);
      break;
    case "delta":
      handlers.onDelta((payload as { content: string }).content);
      break;
    case "done":
      handlers.onDone(payload as StreamDonePayload);
      break;
    case "error":
      handlers.onError((payload as { message: string }).message);
      break;
  }
}

function processSSEBuffer(buffer: string, handlers: StreamHandlers): string {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() || "";

  for (const part of parts) {
    const parsed = parseSSEBlock(part);
    if (!parsed) continue;
    try {
      const payload = JSON.parse(parsed.data);
      dispatchSSEEvent(parsed.event, payload, handlers);
    } catch {
      handlers.onError("流式数据解析失败");
    }
  }

  return remainder;
}

/** 浏览器端 SSE 流式 POST（axios 不支持 ReadableStream 消费，故用 fetch） */
export async function streamRequest(
  url: string,
  body: unknown,
  handlers: StreamHandlers,
  options?: StreamOptions
): Promise<void> {
  const response = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  await consumeSSE(response, handlers);
}

/** 续订进行中的 SSE 流（GET，无请求体） */
export async function streamGet(
  url: string,
  handlers: StreamHandlers,
  options?: StreamOptions
): Promise<void> {
  const response = await fetch(`${BASE_URL}${url}`, {
    method: "GET",
    headers: { Accept: "text/event-stream" },
    signal: options?.signal,
  });

  await consumeSSE(response, handlers);
}

async function consumeSSE(
  response: Response,
  handlers: StreamHandlers
): Promise<void> {
  if (!response.ok) {
    let message = response.statusText;
    try {
      const err = await response.json();
      if (typeof err.detail === "string") message = err.detail;
    } catch {
      // ignore
    }
    if (response.status === 405) {
      message =
        "接口 Method Not Allowed：后端未加载最新代码，请在项目根目录执行 python web_server.py 重启后端";
    }
    throw new Error(message);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("浏览器不支持流式响应");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = processSSEBuffer(buffer, handlers);
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    processSSEBuffer(buffer + "\n\n", handlers);
  }
}

export default http;
