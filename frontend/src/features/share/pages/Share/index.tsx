import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Spin, Typography, message } from "antd";
import { CompassOutlined, HomeOutlined } from "@ant-design/icons";
import ChatMessages from "@/features/chat/components/ChatMessages";
import { shareApi } from "@/shared/api";
import type { ShareDetail } from "@/shared/types";
import "./index.less";

const { Title, Text } = Typography;

export default function SharePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ShareDetail | null>(null);

  useEffect(() => {
    if (!token) return;
    shareApi
      .getShare(token)
      .then(setDetail)
      .catch((err) => {
        message.error(err instanceof Error ? err.message : "分享内容不存在");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="share-page share-page--loading">
        <Spin size="large" tip="加载分享内容..." />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="share-page share-page--empty">
        <Title level={4}>分享内容不存在或已失效</Title>
        <Button type="primary" onClick={() => navigate("/")}>
          返回首页
        </Button>
      </div>
    );
  }

  const meta =
    detail.city && detail.days
      ? `${detail.city} · ${detail.days} 天行程`
      : "旅行规划分享";

  return (
    <div className="share-page">
      <header className="share-page__header">
        <div className="share-page__brand">
          <div className="share-page__logo">
            <CompassOutlined />
          </div>
          <div>
            <div className="share-page__brand-title">旅行规划小助手</div>
            <div className="share-page__brand-sub">分享预览</div>
          </div>
        </div>
        <Button icon={<HomeOutlined />} onClick={() => navigate("/")}>
          开始规划
        </Button>
      </header>

      <main className="share-page__main">
        <div className="share-page__card">
          <Title level={3} className="share-page__title">
            {detail.title}
          </Title>
          <Text className="share-page__meta">{meta}</Text>

          {detail.share_type === "plan" && detail.content ? (
            <div className="share-page__plan">
              <ChatMessages
                messages={[
                  ...(detail.user_message ? [detail.user_message] : []),
                  {
                    id: detail.message_id ?? "plan",
                    role: "assistant",
                    content: detail.content,
                    created_at: detail.created_at,
                  },
                ]}
                sessionTitle={detail.title}
                readOnly
              />
            </div>
          ) : (
            <div className="share-page__conversation">
              <ChatMessages
                messages={detail.messages ?? []}
                sessionTitle={detail.title}
                readOnly
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
