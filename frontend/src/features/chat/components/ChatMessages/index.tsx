import { FileTextOutlined } from "@ant-design/icons";
import MarkdownContent from "@/shared/components/MarkdownContent";
import { isTravelPlanContent } from "@/features/travel-plan/parsers/parseTravelPlan";
import PlanMessageActions from "@/features/chat/components/PlanMessageActions";
import type { Message } from "@/shared/types";
import "./index.less";

interface ChatMessagesProps {
  messages: Message[];
  statusText?: string;
  conversationId?: string;
  city?: string;
  days?: number;
  sessionTitle?: string;
  readOnly?: boolean;
}

function StreamingCursor() {
  return <span className="chat-messages__cursor" />;
}

function TypingIndicator() {
  return (
    <div className="chat-messages__typing">
      <span />
      <span />
      <span />
    </div>
  );
}

function isCompletePlanMessage(msg: Message): boolean {
  if (msg.role !== "assistant" || msg.streaming || msg.stopped) return false;
  return isTravelPlanContent(msg.content);
}

export default function ChatMessages({
  messages,
  statusText,
  conversationId,
  city = "",
  days = 0,
  sessionTitle = "",
  readOnly = false,
}: ChatMessagesProps) {
  if (messages.length === 0 && !statusText) {
    return (
      <div className="chat-messages__welcome">
        <div className="chat-messages__welcome-icon">✈</div>
        <h3>开始规划您的旅程</h3>
        <p>告诉我目的地、天数和偏好，我将为您生成完整攻略</p>
      </div>
    );
  }

  const hasStreamingAssistant = messages.some(
    (m) => m.role === "assistant" && m.streaming
  );

  return (
    <div className="chat-messages">
      {messages.map((msg) => {
        const isPlan = isCompletePlanMessage(msg);
        const showPlanActions =
          !readOnly && conversationId && isPlan;

        if (isPlan) {
          return (
            <div
              key={msg.id}
              className="chat-messages__document"
            >
              <div className="chat-messages__document-head">
                <div className="chat-messages__document-head-left">
                  <FileTextOutlined className="chat-messages__document-icon" />
                  <span className="chat-messages__document-label">旅行攻略</span>
                  {sessionTitle && (
                    <span className="chat-messages__document-title">
                      {sessionTitle}
                    </span>
                  )}
                </div>
                {showPlanActions && (
                  <PlanMessageActions
                    conversationId={conversationId}
                    messageId={msg.id}
                    content={msg.content}
                    city={city}
                    days={days}
                    title={sessionTitle}
                  />
                )}
              </div>
              <div className="chat-messages__document-body">
                <MarkdownContent content={msg.content || " "} />
              </div>
            </div>
          );
        }

        return (
          <div
            key={msg.id}
            className={`chat-messages__row chat-messages__row--${msg.role}`}
          >
            {msg.role === "assistant" && (
              <div className="chat-messages__meta">
                <div className="chat-messages__avatar chat-messages__avatar--ai">
                  AI
                </div>
                <span className="chat-messages__name">旅行助手</span>
              </div>
            )}

            <div
              className={`chat-messages__bubble chat-messages__bubble--${msg.role}`}
            >
              {msg.role === "assistant" ? (
                <>
                  {msg.streaming && !msg.content ? (
                    <div className="chat-messages__pending">
                      <TypingIndicator />
                      {statusText && (
                        <span className="chat-messages__pending-text">
                          {statusText}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <MarkdownContent content={msg.content || " "} />
                      {msg.streaming && <StreamingCursor />}
                    </>
                  )}
                </>
              ) : (
                <span className="chat-messages__user-text">{msg.content}</span>
              )}
            </div>

            {msg.role === "user" && (
              <div className="chat-messages__avatar chat-messages__avatar--user">
                我
              </div>
            )}
          </div>
        );
      })}

      {statusText && !hasStreamingAssistant && (
        <div className="chat-messages__status">
          <TypingIndicator />
          <span>{statusText}</span>
        </div>
      )}
    </div>
  );
}
