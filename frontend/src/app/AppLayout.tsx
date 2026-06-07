import { useCallback, useEffect, useState } from "react";
import {
  Outlet,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Modal, message } from "antd";
import AppShell from "@/shared/components/AppShell";
import { AppProvider } from "@/shared/context/AppContext";
import { conversationApi } from "@/shared/api";
import type { ConversationSummary } from "@/shared/types";

export default function AppLayout() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 992);

  const refreshConversations = useCallback(async () => {
    const list = await conversationApi.list();
    setConversations(list);
    return list;
  }, []);

  useEffect(() => {
    refreshConversations().catch(() => {
      message.error("加载会话列表失败");
    });
  }, [refreshConversations]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 992) setSidebarOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSelectConversation = useCallback(
    (id: string) => {
      navigate(`/chat/${id}`);
      if (window.innerWidth < 992) setSidebarOpen(false);
    },
    [navigate]
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      Modal.confirm({
        title: "删除对话",
        content: "确定删除该对话吗？此操作不可恢复。",
        okText: "删除",
        okType: "danger",
        cancelText: "取消",
        onOk: async () => {
          await conversationApi.delete(id);
          const list = await refreshConversations();
          if (list.length === 0) {
            navigate("/");
            return;
          }
          if (id === conversationId) {
            navigate(`/chat/${list[0].id}`);
          }
        },
      });
    },
    [conversationId, navigate, refreshConversations]
  );

  return (
    <AppProvider refreshConversations={refreshConversations}>
      <AppShell
        conversations={conversations}
        activeConversationId={conversationId ?? null}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onCloseSidebar={() => setSidebarOpen(false)}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onNewChat={() => navigate("/")}
      >
        <Outlet />
      </AppShell>
    </AppProvider>
  );
}
