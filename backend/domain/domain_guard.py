"""
领域守门模块（Domain Guard）。

业务职责：
1. 首规划态：拦截非旅行输入，放行含旅行语义或「X天/日游」的表述
2. 追问态：仅拦截明显离题
3. 路由判断：新行程 / 攻略修订 / 细节问答 / 合并进攻略
"""

import re
from typing import Literal, Optional

from backend.core import config

FollowupMode = Literal["new_trip", "plan_revise", "detail_qa", "merge_to_plan"]


def _contains_keyword(text: str, keywords: tuple) -> bool:
    lower = text.lower()
    for kw in keywords:
        if kw.lower() in lower or kw in text:
            return True
    return False


def looks_like_trip_request(text: str) -> bool:
    """规则：含「N天 / 日游 / 周末 / 假期」视为可能的行程需求。"""
    if re.search(r"\d+\s*天", text):
        return True
    if "日游" in text or "周末" in text or "假期" in text:
        return True
    return False


def reject_message() -> str:
    return f"{config.DOMAIN_REJECT_MESSAGE}\n{config.DOMAIN_GUIDE}"


def validate_new_request(text: str) -> Optional[str]:
    """首规划态领域校验。"""
    text = text.strip()
    if _contains_keyword(text, config.OFF_TOPIC_KEYWORDS):
        return reject_message()
    if _contains_keyword(text, config.TRAVEL_KEYWORDS):
        return None
    if looks_like_trip_request(text):
        return None
    return reject_message()


def validate_followup(text: str) -> Optional[str]:
    """追问态领域校验：仅拦截明显离题。"""
    if _contains_keyword(text.strip(), config.OFF_TOPIC_KEYWORDS):
        return reject_message()
    return None


def is_plan_revision(text: str) -> bool:
    """是否要求修改既有攻略（增删景点、调节奏等）。"""
    return any(k in text for k in config.PLAN_REVISE_KEYWORDS)


def is_detail_question(text: str) -> bool:
    """是否为细节追问（如推荐小吃、交通、门票），不应重出完整攻略。"""
    text = text.strip()
    if is_plan_revision(text):
        return False
    if _contains_keyword(text, config.MERGE_TO_PLAN_KEYWORDS):
        return False
    if _contains_keyword(text, config.DETAIL_QA_KEYWORDS):
        return True
    if len(text) <= 50 and (text.endswith("?") or text.endswith("？")):
        return not looks_like_trip_request(text)
    return False


def is_new_trip_request(text: str, current_city: str) -> bool:
    """是否应触发重新规划。"""
    if any(k in text for k in config.REPLAN_KEYWORDS):
        return True
    if is_plan_revision(text):
        return False
    if is_detail_question(text):
        return False
    if any(k in text for k in config.MERGE_TO_PLAN_KEYWORDS):
        return False
    if looks_like_trip_request(text):
        return True
    if current_city and current_city in text and len(text) <= 30:
        return False
    return False


def classify_followup(text: str, current_city: str, days: int = 0) -> FollowupMode:
    """追问态路由：规则 + LLM 混合分类。"""
    from backend.domain.followup_classifier import classify_followup_smart

    return classify_followup_smart(text, current_city, days)
