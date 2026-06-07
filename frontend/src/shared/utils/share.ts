import { stripGalleryFromText } from "@/features/travel-plan/parsers/parseTravelPlan";

/** 构建分享页完整 URL */
export function buildShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

/** 复制文本到剪贴板 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export type ShareLinkResult =
  | { ok: true; url: string; copied: boolean }
  | { ok: false; error: string };

/** 创建分享 token 并复制链接 */
export async function shareLink(
  createToken: () => Promise<{ token: string }>
): Promise<ShareLinkResult> {
  try {
    const { token } = await createToken();
    const url = buildShareUrl(token);
    const copied = await copyToClipboard(url);
    return { ok: true, url, copied };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "生成分享链接失败",
    };
  }
}

/** 下载攻略为 TXT 文件 */
export function downloadPlanAsTxt(
  content: string,
  options: { city?: string; days?: number; title?: string } = {}
): void {
  const city = options.city?.trim() || "旅行";
  const days = options.days || 0;
  const title = options.title?.trim() || `${city}攻略`;
  const now = new Date().toLocaleString("zh-CN");

  const body = stripGalleryFromText(content.trim());

  const text = [
    "旅行规划小助手 - 导出报告",
    `标题：${title}`,
    days > 0 ? `目的地：${city}` : "",
    days > 0 ? `天数：${days} 天` : "",
    `导出时间：${now}`,
    "=".repeat(50),
    "",
    body,
  ]
    .filter(Boolean)
    .join("\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName = `${city}${days > 0 ? `${days}日游` : "攻略"}`.replace(
    /[\\/:*?"<>|]/g,
    ""
  );
  anchor.href = url;
  anchor.download = `${safeName}_${Date.now()}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}
