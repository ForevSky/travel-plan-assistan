import { Tooltip, message } from "antd";
import { DownloadOutlined, ShareAltOutlined } from "@ant-design/icons";
import { shareApi } from "@/shared/api";
import { downloadPlanAsTxt, shareLink } from "@/shared/utils/share";
import "./index.less";

interface PlanMessageActionsProps {
  conversationId: string;
  messageId: string;
  content: string;
  city?: string;
  days?: number;
  title?: string;
}

export default function PlanMessageActions({
  conversationId,
  messageId,
  content,
  city = "",
  days = 0,
  title = "",
}: PlanMessageActionsProps) {
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await shareLink(() =>
      shareApi.createPlanShare(conversationId, messageId)
    );
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    if (result.copied) {
      message.success("攻略分享链接已复制");
    } else {
      message.info(`分享链接：${result.url}`);
    }
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadPlanAsTxt(content, { city, days, title });
    message.success("攻略已下载");
  };

  return (
    <div className="plan-message-actions">
      <Tooltip title="分享此条攻略">
        <button
          type="button"
          className="plan-message-actions__btn"
          onClick={handleShare}
          aria-label="分享攻略"
        >
          <ShareAltOutlined />
        </button>
      </Tooltip>
      <Tooltip title="导出此条攻略">
        <button
          type="button"
          className="plan-message-actions__btn"
          onClick={handleExport}
          aria-label="导出攻略"
        >
          <DownloadOutlined />
        </button>
      </Tooltip>
    </div>
  );
}
