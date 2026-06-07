export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  streaming?: boolean;
  stopped?: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  has_plan: boolean;
}

export interface ConversationDetail extends ConversationSummary {
  messages: Message[];
  city: string;
  days: number;
}

export interface StreamDonePayload {
  user_message: Message;
  assistant_message: Message;
  has_plan: boolean;
  city: string;
  days: number;
  title?: string;
}

export interface ShareDetail {
  token: string;
  share_type: "conversation" | "plan";
  title: string;
  city: string;
  days: number;
  created_at: string;
  content?: string;
  message_id?: string;
  user_message?: Message;
  messages?: Message[];
}

export interface ShareCreateResponse {
  token: string;
}
