"""
追问意图分类：规则预判 + LLM 精分类。

模式说明：
- new_trip: 换城市 / 重新完整规划
- plan_revise: 修改既有攻略结构
- detail_qa: 局部细节问答，不重出完整攻略
- merge_to_plan: 将上一轮回答合并写入完整攻略
"""

from backend.core import config, llm_client
from backend.domain import domain_guard
from backend.domain.json_utils import extract_json

FollowupMode = domain_guard.FollowupMode

CLASSIFY_SYSTEM = (
    "你是旅行对话意图分类器。只输出一行 JSON，不要 markdown，不要解释。"
)

VALID_MODES = frozenset({"new_trip", "plan_revise", "detail_qa", "merge_to_plan"})


def is_merge_to_plan_request(text: str) -> bool:
    return any(k in text for k in config.MERGE_TO_PLAN_KEYWORDS)


def _rule_classify(text: str, current_city: str) -> FollowupMode:
    if domain_guard.is_new_trip_request(text, current_city):
        return "new_trip"
    if is_merge_to_plan_request(text):
        return "merge_to_plan"
    if domain_guard.is_detail_question(text):
        return "detail_qa"
    if domain_guard.is_plan_revision(text):
        return "plan_revise"
    if len(text.strip()) <= 60:
        return "detail_qa"
    return "plan_revise"


def _is_high_confidence(text: str, mode: FollowupMode) -> bool:
    if mode == "new_trip" and any(k in text for k in config.REPLAN_KEYWORDS):
        return True
    if mode == "merge_to_plan" and is_merge_to_plan_request(text):
        return True
    if mode == "plan_revise" and domain_guard.is_plan_revision(text):
        return True
    if mode == "detail_qa" and domain_guard.is_detail_question(text):
        if "?" in text or "？" in text:
            return True
        if any(k in text for k in ("小吃", "美食", "门票", "交通", "天气")):
            return True
    return False


def _build_classify_prompt(
    user_input: str, city: str, days: int, rule_hint: FollowupMode
) -> str:
    return f"""用户已在规划【{city} {days} 天】旅行攻略，现发送追问消息。

用户消息：{user_input}
规则预判（仅供参考）：{rule_hint}

请分类为以下之一：
- detail_qa：追问局部细节（推荐小吃/交通/门票/天气等），只需针对性回答，不要完整攻略
- plan_revise：要求修改攻略结构（删改景点、调节奏、换酒店、加人数等）
- merge_to_plan：要求把「上一轮助手回答」或「刚才讨论的内容」合并写进完整攻略
- new_trip：换城市、换天数、重新做一份完整规划

输出 JSON 示例：
{{"mode":"detail_qa","confidence":0.92,"reason":"用户在问当地小吃"}}

mode 必须是四者之一。"""


def classify_followup_llm(
    user_input: str, city: str, days: int, rule_hint: FollowupMode
) -> FollowupMode:
    try:
        raw = llm_client.chat(
            CLASSIFY_SYSTEM,
            _build_classify_prompt(user_input, city, days, rule_hint),
            temperature=0,
            max_tokens=config.MAX_TOKENS_INTENT,
            silent=True,
        )
    except RuntimeError:
        return rule_hint

    data = extract_json(raw)
    if not data:
        return rule_hint

    mode = str(data.get("mode", "")).strip()
    if mode in VALID_MODES:
        return mode  # type: ignore[return-value]
    return rule_hint


def classify_followup_smart(
    user_input: str, current_city: str, days: int = 0
) -> FollowupMode:
    """规则 + LLM 混合分类。"""
    rule_mode = _rule_classify(user_input, current_city)
    if _is_high_confidence(user_input, rule_mode):
        return rule_mode
    if not config.USE_LLM_FOLLOWUP_CLASSIFIER:
        return rule_mode
    return classify_followup_llm(user_input, current_city, days, rule_mode)
