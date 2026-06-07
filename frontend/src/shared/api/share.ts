import { request } from "./client";
import type { ShareCreateResponse, ShareDetail } from "@/shared/types";

export const shareApi = {
  createConversationShare: (convId: string) =>
    request<ShareCreateResponse>({
      url: `/conversations/${convId}/share`,
      method: "POST",
    }),

  createPlanShare: (convId: string, messageId: string) =>
    request<ShareCreateResponse>({
      url: `/conversations/${convId}/messages/${messageId}/share`,
      method: "POST",
    }),

  getShare: (token: string) =>
    request<ShareDetail>({
      url: `/share/${token}`,
      method: "GET",
    }),
};

export default shareApi;
