import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Typography, message } from "antd";
import { CompassOutlined, SendOutlined } from "@ant-design/icons";
import { conversationApi } from "@/shared/api";
import { useAppContext } from "@/shared/context/AppContext";
import "./index.less";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const EXAMPLES = [
  "我想去杭州两日游，轻松一点",
  "帮我规划成都3天，想吃火锅看熊猫",
  "威海3天亲子游，节奏不要太赶",
];

export default function HomePage() {
  const navigate = useNavigate();
  const { refreshConversations } = useAppContext();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStart = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) {
      message.warning("请输入旅行需求");
      return;
    }
    setLoading(true);
    try {
      const conv = await conversationApi.create();
      await refreshConversations();
      navigate(`/chat/${conv.id}`, { state: { initialMessage: content } });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "创建会话失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      <div className="home-page__inner">
        <div className="home-page__hero">
          <div className="home-page__hero-icon">
            <CompassOutlined />
          </div>
          <Title level={3} className="home-page__title">
            开始规划您的旅程
          </Title>
          <Paragraph className="home-page__subtitle">
            描述目的地、天数与偏好，AI 将为您生成完整攻略
          </Paragraph>
        </div>

        <div className="home-page__composer">
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如：我想去杭州两日游，轻松一点"
            autoSize={{ minRows: 3, maxRows: 6 }}
            className="home-page__textarea"
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleStart();
              }
            }}
            disabled={loading}
          />
          <div className="home-page__composer-foot">
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={loading}
              onClick={() => handleStart()}
              className="home-page__send"
            >
              开始规划
            </Button>
          </div>
        </div>

        <div className="home-page__examples">
          <Text className="home-page__examples-label">试试这些示例</Text>
          <div className="home-page__chips">
            {EXAMPLES.map((item) => (
              <button
                key={item}
                type="button"
                className="home-page__chip"
                onClick={() => {
                  setInput(item);
                  handleStart(item);
                }}
                disabled={loading}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
