"""
意图解析模块（Intent Parser）。

业务职责：
1. 将自然语言解析为结构化行程参数：city + days
2. 二次领域校验（travel_related），与 domain_guard 规则层互补
3. 输出明确的中文错误信息，供上层引导用户重输

调用时机：仅「新规划 / 重新规划」路径，追问修订不调用。
"""

from typing import Optional, Tuple

from backend.core import config, llm_client
from backend.domain import validator
from backend.domain.json_utils import extract_json
from backend.presentation import formatter

PARSE_SYSTEM = "你是旅行需求解析器。只输出一行 JSON，不要 markdown，不要任何解释文字。"


def _precheck(user_input: str) -> Optional[str]:
    """本地规则预检，拦截明显非法输入，减少无效 API 调用。"""
    text = user_input.strip()
    if text.isdigit():
        return "无法识别有效目的地，请说明具体城市，例如：成都玩3天"
    if len(text) < 2:
        return "描述过短，请重新输入，例如：杭州两日游"
    return None


def _build_parse_prompt(user_request: str) -> str:
    return f"""解析以下旅行需求，提取目的地城市与出行天数。

用户输入：{user_request}

规则：
- 首先判断输入是否属于【旅行规划】领域（目的地、行程、景点、美食、住宿、交通、预算、出行天数等）
- 若与旅行无关（如编程、理财、闲聊、通用问答等），输出 travel_related=false, valid=false
- 与旅行相关的季节、天气、穿衣、是否下雨等出行问题属于本领域，travel_related=true
- city 必须是具体中国城市或地区名称（如：成都、杭州、西安）
- 禁止将数字、菜单符号当作城市
- days 必须是 {config.MIN_TRIP_DAYS}-{config.MAX_TRIP_DAYS} 的整数
- 未提及天数时，仅当语境明确可推断才给出 2 或 3；否则 valid=false
- 无法识别有效城市，或 days 不在允许范围，则 valid=false
- message 用中文简要说明原因；若 travel_related=false，message 须引导用户描述旅行需求

输出 JSON 示例（旅行相关）：
{{"travel_related":true,"valid":true,"city":"成都","days":3,"message":""}}
输出 JSON 示例（非旅行）：
{{"travel_related":false,"valid":false,"city":"","days":0,"message":"请描述旅行需求，例如：我想去成都玩3天"}}"""


def _validate_parsed(city: str, days: int) -> Optional[str]:
    """解析结果落地校验（最后一道防线）。"""
    if formatter.is_exit_command(city) or city.isdigit():
        return "目的地无效，请输入真实城市名称，例如：成都"

    city_err = validator.validate_city(city)
    if city_err:
        return city_err

    return validator.validate_days(days)


def parse(user_request: str, *, silent: bool = False) -> Tuple[Optional[str], Optional[int], str]:
    """
    解析用户自然语言需求。

    Returns:
        (city, days, error_message)
        成功时 error_message 为空字符串。
    """
    pre_err = _precheck(user_request)
    if pre_err:
        return None, None, pre_err

    try:
        raw = llm_client.chat(
            PARSE_SYSTEM,
            _build_parse_prompt(user_request),
            temperature=0,
            max_tokens=config.MAX_TOKENS_PARSE,
            silent=silent,
        )
    except RuntimeError as exc:
        return None, None, str(exc)

    data = extract_json(raw)
    if not data:
        return None, None, "无法理解您的需求，请说明具体城市和天数，例如：成都玩3天"

    if data.get("travel_related") is False:
        msg = str(data.get("message", "")).strip()
        return None, None, msg or f"{config.DOMAIN_REJECT_MESSAGE}\n{config.DOMAIN_GUIDE}"

    if not data.get("valid"):
        msg = str(data.get("message", "")).strip()
        return None, None, msg or "无法识别有效的城市或天数，请重新输入"

    city = str(data.get("city", "")).strip()
    try:
        days = int(data.get("days"))
    except (TypeError, ValueError):
        return None, None, "无法识别有效出行天数，请说明 1-7 天，例如：成都玩3天"

    val_err = _validate_parsed(city, days)
    if val_err:
        return None, None, val_err

    return city, days, ""
