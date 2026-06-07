import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import {
  CompassOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import ConversationSidebar from "@/features/chat/components/ConversationSidebar";
import type { ConversationSummary } from "@/shared/types";
import "./index.less";

interface AppShellProps {
  children: ReactNode;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewChat: () => void;
}

export default function AppShell({
  children,
  conversations,
  activeConversationId,
  sidebarOpen,
  onToggleSidebar,
  onCloseSidebar,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
}: AppShellProps) {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-left">
          <Button
            type="text"
            icon={sidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={onToggleSidebar}
            className="app-shell__sidebar-toggle"
            aria-label={sidebarOpen ? "收起对话列表" : "展开对话列表"}
          />
          <div
            className="app-shell__brand"
            onClick={() => navigate("/")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate("/")}
          >
            <div className="app-shell__logo">
              <CompassOutlined />
            </div>
            <div className="app-shell__brand-text">
              <span className="app-shell__title">旅行规划小助手</span>
              <span className="app-shell__subtitle">智能行程规划</span>
            </div>
          </div>
        </div>
      </header>

      <div className="app-shell__body">
        {sidebarOpen && (
          <div
            className="app-shell__sidebar-overlay"
            onClick={onCloseSidebar}
            aria-hidden
          />
        )}

        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          visible={sidebarOpen}
          onSelect={onSelectConversation}
          onDelete={onDeleteConversation}
          onNew={onNewChat}
        />

        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}
