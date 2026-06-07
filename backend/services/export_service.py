"""文件导出服务：将攻略持久化为本地 TXT。"""

import re
from datetime import datetime
from pathlib import Path

from backend.core import config
from backend.domain import validator

INVALID_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|]')
_GALLERY_NUM = r"(?:[一二三四五六七八九十百廿卅\d]+[、.．]\s*)"
_GALLERY_TITLE = r"(?:关联图示|关联图片|图示索引)"
GALLERY_HEADER_LINE_RE = re.compile(
    rf"(?:^|\n)\s*(?:#{{1,4}}\s*)?{_GALLERY_NUM}?{_GALLERY_TITLE}(?:\s*(?:$|\n))",
    re.IGNORECASE | re.MULTILINE,
)
GALLERY_HEADER_INLINE_RE = re.compile(
    rf"[。；;！!?\?](?=\s*(?:#{{1,4}}\s*)?{_GALLERY_NUM}?{_GALLERY_TITLE})",
    re.IGNORECASE | re.MULTILINE,
)
IMG_TAG_RE = re.compile(r"@img\[[^|\]]+\|[^|\]]+\|[^\]]*\]")


def _find_gallery_start(content: str) -> int:
    """定位关联图示章节起始位置，与前端 stripGalleryFromText 逻辑对齐。"""
    cut_at = -1
    line_match = GALLERY_HEADER_LINE_RE.search(content)
    if line_match:
        cut_at = line_match.start()
    inline_match = GALLERY_HEADER_INLINE_RE.search(content)
    if inline_match:
        pos = inline_match.start() + 1
        if cut_at == -1 or pos < cut_at:
            cut_at = pos
    return cut_at


def strip_gallery_from_text(content: str) -> str:
    """移除「关联图示」章节及 @img 标签（展示/导出通用）。"""
    cut_at = _find_gallery_start(content)
    if cut_at >= 0:
        return content[:cut_at].strip()
    return IMG_TAG_RE.sub("", content).strip()


def _strip_gallery_for_export(content: str) -> str:
    """导出时移除「关联图示」章节及 @img 标签。"""
    return strip_gallery_from_text(content)


def _safe_city_name(city: str) -> str:
    name = INVALID_FILENAME_CHARS.sub("", city.strip())
    return name or "未知城市"


def _build_filepath(output_dir: Path, city: str, days: int) -> Path:
    """命名规范：城市_x日游_YYYYMMDD.txt，同日重复则追加序号。"""
    date_str = datetime.now().strftime("%Y%m%d")
    base = f"{_safe_city_name(city)}_{days}日游_{date_str}.txt"
    filepath = output_dir / base
    if not filepath.exists():
        return filepath
    index = 2
    while True:
        candidate = output_dir / f"{_safe_city_name(city)}_{days}日游_{date_str}_{index}.txt"
        if not candidate.exists():
            return candidate
        index += 1


def save(content: str, city: str, days: int) -> str:
    """
    保存攻略到 output/ 目录。

    Raises:
        ValueError: 内容为空或元数据无效
    """
    content = _strip_gallery_for_export(content.strip())
    if not content:
        raise ValueError("当前没有可保存的内容，请先生成旅行规划")
    if not city or not city.strip():
        raise ValueError("缺少城市信息，无法保存")

    days_err = validator.validate_days(days)
    if days_err:
        raise ValueError(days_err)

    output_dir = config.ensure_output_dir()
    filepath = _build_filepath(output_dir, city, days)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    text = "\n".join([
        "旅行规划小助手 - 导出报告",
        f"目的地：{city}",
        f"天数：{days} 天",
        f"生成时间：{now}",
        "=" * 50,
        "",
        content,
    ])
    filepath.write_text(text, encoding="utf-8")
    return str(filepath)


def filename_from_path(filepath: str) -> str:
    """仅返回文件名，避免向前端泄露服务器绝对路径。"""
    return Path(filepath).name
