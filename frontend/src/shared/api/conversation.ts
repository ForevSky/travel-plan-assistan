import { request, streamRequest, streamGet, type StreamOptions } from "./client";
import type {
  ConversationDetail,
  ConversationSummary,
  Message,
  StreamDonePayload,
} from "@/shared/types";

/** 会话相关 API 路径 */
const PATHS = {
  conversations: "/conversations",
  conversation: (id: string) => `/conversations/${id}`,
  messagesStream: (id: string) => `/conversations/${id}/messages/stream`,
} as const;

export const conversationApi = {
  list: () =>
    request<ConversationSummary[]>({
      url: PATHS.conversations,
      method: "GET",
    }),

  create: (title = "新对话") =>
    request<ConversationDetail>({
      url: PATHS.conversations,
      method: "POST",
      data: { title },
    }),

  get: (id: string) =>
    request<ConversationDetail>({
      url: PATHS.conversation(id),
      method: "GET",
    }),

  delete: (id: string) =>
    request<void>({
      url: PATHS.conversation(id),
      method: "DELETE",
    }),

  sendMessageStream: (
    id: string,
    content: string,
    handlers: {
      onUserMessage?: (msg: Message) => void;
      onStatus?: (text: string) => void;
      onDelta: (delta: string) => void;
      onDone: (payload: StreamDonePayload) => void;
      onError: (message: string) => void;
    },
    options?: StreamOptions
  ) => streamRequest(PATHS.messagesStream(id), { content }, handlers, options),

  reconnectStream: (
    id: string,
    handlers: {
      onUserMessage?: (msg: Message) => void;
      onStatus?: (text: string) => void;
      onDelta: (delta: string) => void;
      onDone: (payload: StreamDonePayload) => void;
      onError: (message: string) => void;
    },
    options?: StreamOptions
  ) => streamGet(PATHS.messagesStream(id), handlers, options),
};

export default conversationApi;
