import { useMemo, useState } from "react";
import { Button, Empty, Input, Tag, Tooltip } from "antd";
import {
  DeleteOutlined,
  FileTextOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ConversationSummary } from "@/shared/types";
import "./index.less";

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  visible: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function getGroupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000);

  if (date >= startOfToday) return "今天";
  if (date >= startOfYesterday) return "昨天";
  if (date >= startOfWeek) return "近 7 天";
  return "更早";
}

const GROUP_ORDER = ["今天", "昨天", "近 7 天", "更早"];

export default function ConversationSidebar({
  conversations,
  activeId,
  visible,
  onSelect,
  onDelete,
  onNew,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ConversationSummary[]>();
    for (const conv of filtered) {
      const label = getGroupLabel(conv.updated_at);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(conv);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      label: g,
      items: map.get(g)!,
    }));
  }, [filtered]);

  return (
    <aside
      className={`conv-sidebar${visible ? "" : " conv-sidebar--collapsed"}`}
    >
      <div className="conv-sidebar__top">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={onNew}
          className="conv-sidebar__new-btn"
        >
          新建对话
        </Button>
        <Input
          prefix={<SearchOutlined className="conv-sidebar__search-icon" />}
          placeholder="搜索对话"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="conv-sidebar__search"
        />
      </div>

      <div className="conv-sidebar__list">
        {filtered.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={search ? "无匹配对话" : "暂无对话"}
            className="conv-sidebar__empty"
          />
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="conv-sidebar__group">
              <div className="conv-sidebar__group-label">{group.label}</div>
              {group.items.map((conv) => (
                <div
                  key={conv.id}
                  className={`conv-sidebar__item ${
                    conv.id === activeId ? "conv-sidebar__item--active" : ""
                  }`}
                  onClick={() => onSelect(conv.id)}
                >
                  <MessageOutlined className="conv-sidebar__icon" />
                  <div className="conv-sidebar__content">
                    <div className="conv-sidebar__title-row">
                      <span className="conv-sidebar__title">{conv.title}</span>
                    </div>
                    <div className="conv-sidebar__time">
                      {formatTime(conv.updated_at)}
                    </div>
                  </div>
                  <div className="conv-sidebar__actions">
                    <Tooltip title="删除">
                      <button
                        type="button"
                        className="conv-sidebar__action conv-sidebar__action--delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(conv.id);
                        }}
                      >
                        <DeleteOutlined />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
