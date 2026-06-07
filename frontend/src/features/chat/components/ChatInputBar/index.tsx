import { Button, Input } from "antd";
import { ArrowUpOutlined, PauseOutlined } from "@ant-design/icons";
import "./index.less";

const { TextArea } = Input;

interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  loading?: boolean;
  placeholder?: string;
}

export default function ChatInputBar({
  value,
  onChange,
  onSend,
  onStop,
  loading = false,
  placeholder = "描述您的旅行需求...",
}: ChatInputBarProps) {
  const canSend = value.trim().length > 0 && !loading;

  return (
    <div className="chat-input-bar">
      <div className="chat-input-bar__wrap">
        <TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoSize={{ minRows: 1, maxRows: 5 }}
          disabled={loading}
          className="chat-input-bar__textarea"
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        <Button
          type="primary"
          shape="circle"
          icon={loading ? <PauseOutlined /> : <ArrowUpOutlined />}
          disabled={loading ? false : !canSend}
          onClick={loading ? onStop : onSend}
          className={`chat-input-bar__send${loading ? " chat-input-bar__send--stop" : ""}`}
          aria-label={loading ? "停止生成" : "发送"}
        />
      </div>
      <p className="chat-input-bar__hint">
        Enter 发送 · Shift+Enter 换行 · 输出为 AI 建议，出行前请核实官方信息
      </p>
    </div>
  );
}
