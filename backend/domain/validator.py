"""输入校验：城市名、保存指令等结构化规则。"""

from typing import Optional

from backend.core import config
from backend.presentation import formatter


def validate_city(city: str) -> Optional[str]:
    """校验解析后的目的地城市名。"""
    city = city.strip()
    if not city:
        return "目的地不能为空"
    if len(city) > config.MAX_CITY_NAME_LEN:
        return f"目的地名称不能超过 {config.MAX_CITY_NAME_LEN} 个字符"
    return None


def validate_days(days: int) -> Optional[str]:
    """校验行程天数是否在业务允许范围内。"""
    if days < config.MIN_TRIP_DAYS or days > config.MAX_TRIP_DAYS:
        return f"出行天数需在 {config.MIN_TRIP_DAYS}-{config.MAX_TRIP_DAYS} 天之间，请重新输入"
    return None


def is_save_request(text: str) -> bool:
    """判断是否触发保存动作（Y / 保存 / export 等）。"""
    t = text.strip()
    if not t:
        return False
    if t.upper() in ("Y", "YES"):
        return True
    lower = t.lower()
    if lower in ("save", "export"):
        return True
    save_starts = ("保存", "导出", "存一下", "写入文件", "存文件")
    return len(t) <= 20 and any(t.startswith(k) for k in save_starts)


def prompt_yes_no(message: str, default: bool = False) -> bool:
    """API 失败时询问是否启用本地兜底模板。"""
    suffix = "Y/N，直接回车默认"
    suffix += " Y" if default else " N"
    suffix += "）："
    while True:
        value = input(f"{message}（{suffix}").strip().upper()
        if not value:
            return default
        if value in ("Y", "YES", "是"):
            return True
        if value in ("N", "NO", "否"):
            return False
        formatter.print_error("请输入 Y 或 N")
