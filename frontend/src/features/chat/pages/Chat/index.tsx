import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Modal, Space, Spin, Tag, Tooltip, message } from "antd";
import { DeleteOutlined, ShareAltOutlined } from "@ant-design/icons";
import ChatMessages from "@/features/chat/components/ChatMessages";
import ChatInputBar from "@/features/chat/components/ChatInputBar";
import { useChatAutoScroll } from "@/features/chat/hooks/useChatAutoScroll";
import { useAppContext } from "@/shared/context/AppContext";
import { conversationApi, shareApi } from "@/shared/api";
import { shareLink } from "@/shared/utils/share";
import type { ConversationDetail, Message } from "@/shared/types";
import "./index.less";

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshConversations } = useAppContext();

  const [activeConv, setActiveConv] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [booting, setBooting] = useState(true);

  const initialSentRef = useRef(false);
  const streamingRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  const { containerRef, resetStickToBottom } = useChatAutoScroll([
    messages,
    statusText,
  ]);

  useEffect(() => {
    resetStickToBottom();
  }, [conversationId, resetStickToBottom]);

  useEffect(() => {
    initialSentRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const conv = await conversationApi.get(id);
    setActiveConv(conv);
    setMessages(conv.messages);
    return conv;
  }, []);

  useEffect(() => {
    if (!conversationId) {
      navigate("/", { replace: true });
      return;
    }

    const convId = conversationId;

    streamAbortRef.current?.abort();
    streamingRef.current = false;
    setLoading(false);
    setStatusText("");
    setBooting(true);

    let cancelled = false;

    async function boot(id: string) {
      try {
        await loadConversation(id);
      } catch {
        if (!cancelled) {
          message.error("加载会话失败");
          navigate("/", { replace: true });
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot(convId);
    return () => {
      cancelled = true;
    };
  }, [conversationId, loadConversation, navigate]);

  const handleShare = useCallback(async () => {
    if (!activeConv) return;
    const result = await shareLink(() =>
      shareApi.createConversationShare(activeConv.id)
    );
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    if (result.copied) {
      message.success("会话分享链接已复制");
    } else {
      message.info(`分享链接：${result.url}`);
    }
  }, [activeConv]);

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!activeConv || !content || loading || streamingRef.current) return;

      setInput("");
      setLoading(true);
      setStatusText("");
      streamingRef.current = true;
      resetStickToBottom();

      const tempUserId = `temp-user-${Date.now()}`;
      const tempAssistantId = `temp-assistant-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {
          id: tempUserId,
          role: "user",
          content,
          created_at: new Date().toISOString(),
        },
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
          streaming: true,
        },
      ]);

      streamAbortRef.current?.abort();
      const abortController = new AbortController();
      streamAbortRef.current = abortController;

      try {
        await conversationApi.sendMessageStream(
          activeConv.id,
          content,
          {
            onUserMessage: (msg) => {
              setMessages((prev) =>
                prev.map((m) => (m.id === tempUserId ? msg : m))
              );
            },
            onStatus: (t) => setStatusText(t),
            onDelta: (delta) => {
              setStatusText("");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, content: m.content + delta }
                    : m
                )
              );
            },
            onDone: (payload) => {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === tempUserId) return payload.user_message;
                  if (m.id === tempAssistantId)
                    return { ...payload.assistant_message, streaming: false };
                  return m;
                })
              );
              setActiveConv((prev) =>
                prev
                  ? {
                      ...prev,
                      has_plan: payload.has_plan,
                      city: payload.city,
                      days: payload.days,
                      title: payload.title || prev.title,
                    }
                  : prev
              );
              refreshConversations();
            },
            onError: (errMsg) => {
              message.error(errMsg);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, content: errMsg, streaming: false }
                    : m
                )
              );
            },
          },
          { signal: abortController.signal }
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.streaming ? { ...m, streaming: false, stopped: true } : m
            )
          );
          return;
        }
        const errMsg = err instanceof Error ? err.message : "发送失败";
        message.error(errMsg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantId
              ? { ...m, content: errMsg, streaming: false }
              : m
          )
        );
      } finally {
        setLoading(false);
        setStatusText("");
        streamingRef.current = false;
      }
    },
    [activeConv, input, loading, refreshConversations, resetStickToBottom]
  );

  const handleStop = useCallback(() => {
    if (!streamingRef.current) return;
    streamAbortRef.current?.abort();
  }, []);

  const handleDelete = useCallback(() => {
    if (!activeConv) return;
    Modal.confirm({
      title: "删除对话",
      content: "确定删除该对话吗？此操作不可恢复。",
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        streamAbortRef.current?.abort();
        await conversationApi.delete(activeConv.id);
        const list = await refreshConversations();
        if (list.length === 0) {
          navigate("/");
          return;
        }
        navigate(`/chat/${list[0].id}`);
      },
    });
  }, [activeConv, navigate, refreshConversations]);

  useEffect(() => {
    const initialMessage = (location.state as { initialMessage?: string })
      ?.initialMessage;
    if (
      !booting &&
      initialMessage &&
      activeConv &&
      !initialSentRef.current &&
      messages.length === 0
    ) {
      initialSentRef.current = true;
      navigate(location.pathname, { replace: true, state: {} });
      handleSend(initialMessage);
    }
  }, [booting, location, activeConv, messages.length, navigate, handleSend]);

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const canShare =
    activeConv?.has_plan &&
    !loading &&
    !lastAssistant?.stopped;

  if (booting) {
    return (
      <div className="chat-page__loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="chat-page__toolbar">
        <div className="chat-page__toolbar-info">
          <div className="chat-page__session-title">
            {activeConv?.title ?? "新对话"}
          </div>
          {activeConv?.has_plan && (
            <div className="chat-page__tags">
              {activeConv.city && (
                <Tag className="chat-page__tag">{activeConv.city}</Tag>
              )}
              {activeConv.days > 0 && (
                <Tag className="chat-page__tag">{activeConv.days} 天</Tag>
              )}
            </div>
          )}
        </div>
        <Space size={4} className="chat-page__toolbar-actions">
          {canShare && (
            <Tooltip title="分享整个会话（含全部问答）">
              <Button
                type="text"
                icon={<ShareAltOutlined />}
                onClick={handleShare}
                className="chat-page__action-btn"
                aria-label="分享会话"
              >
                分享会话
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      <div
        className="chat-page__messages"
        ref={containerRef}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="chat-page__messages-inner">
          <ChatMessages
            messages={messages}
            statusText={statusText}
            conversationId={activeConv?.id}
            city={activeConv?.city}
            days={activeConv?.days}
            sessionTitle={activeConv?.title}
          />
        </div>
      </div>

      <ChatInputBar
        value={input}
        onChange={setInput}
        onSend={() => handleSend()}
        onStop={handleStop}
        loading={loading}
        placeholder={
          activeConv?.has_plan
            ? "继续追问，例如：不想去灵隐寺 / 保存"
            : "描述您的旅行需求..."
        }
      />
    </div>
  );
}
