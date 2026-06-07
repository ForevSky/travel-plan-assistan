"""
旅行规划业务服务。

对外暴露两类核心能力：
1. run_natural  - 新规划：解析 → 生成完整攻略
2. run_revise   - 追问修订：最小范围改动，更新会话内完整攻略
"""

import re
from typing import Optional, Tuple

from backend.core import config, llm_client, prompts
from backend.domain import intent_parser, validator
from backend.presentation import formatter
from backend.fallback import local_data


def _generate(
    system: str,
    user: str,
    *,
    title: str = "旅行规划",
    max_tokens: Optional[int] = None,
    show_full: bool = True,
    silent: bool = False,
) -> str:
    if max_tokens is None:
        max_tokens = config.MAX_TOKENS_FULL_PLAN
    if not silent:
        formatter.print_info(f"正在{title}，请稍候...")
    result = llm_client.chat(
        system, user, temperature=0.7, max_tokens=max_tokens, silent=silent
    )
    if show_full and not silent:
        formatter.print_section(title, result)
    return result


def _handle_failure(exc: RuntimeError, city: str) -> str:
    """API 失败降级：可选启用本地兜底模板。"""
    formatter.print_error(str(exc))
    if validator.prompt_yes_no("是否使用本地兜底模板", default=False):
        fallback = local_data.get_fallback(city)
        formatter.print_section("本地兜底方案", fallback)
        return fallback
    raise exc


def extract_updated_plan(text: str, fallback: str) -> str:
    """从修订结果中提取完整攻略；缺失时回退上一版，避免会话丢失。"""
    marker = config.UPDATED_PLAN_MARKER
    if marker in text:
        updated = text.split(marker, 1)[1].strip()
        if updated:
            return updated
    return fallback


def extract_display_revision(text: str) -> str:
    """展示给用户的修订摘要（不含完整攻略正文）。"""
    marker = config.UPDATED_PLAN_MARKER
    if marker in text:
        return text.split(marker, 1)[0].strip()
    return text.strip()


def update_meta(city: str, days: int, feedback: str) -> Tuple[str, int]:
    """从追问文本提取天数变更，用于更新导出文件名元数据。"""
    match = re.search(r"(\d+)\s*天", feedback)
    if match:
        new_days = int(match.group(1))
        if config.MIN_TRIP_DAYS <= new_days <= config.MAX_TRIP_DAYS:
            days = new_days
    return city, days


def run(city: str, days: int, extra_request: str = "", *, silent: bool = False) -> str:
    """根据已解析的城市+天数生成完整攻略。"""
    system, user = prompts.build_full_plan_prompt(city, days, extra_request)
    try:
        return _generate(system, user, silent=silent)
    except RuntimeError as exc:
        if silent:
            raise
        return _handle_failure(exc, city)


def run_natural(user_request: str, *, silent: bool = False) -> Tuple[str, str, int]:
    """
    新规划主流程：自然语言 → 结构化参数 → 完整攻略。

    Returns:
        (plan_text, city, days)
    """
    if not silent:
        formatter.print_info("正在理解您的需求...")
    city, days, err = intent_parser.parse(user_request)
    if err:
        raise ValueError(err)

    if not silent:
        formatter.print_info(f"已识别：{city}，{days} 天")
    plan = run(city, days, extra_request=user_request, silent=silent)
    return plan, city, days


def run_revise(
    current_plan: str, city: str, days: int, feedback: str, *, silent: bool = False
) -> Tuple[str, str, int]:
    """
    追问修订主流程：最小范围改动 + 更新会话内完整攻略。

    Returns:
        (updated_plan, city, days)
    """
    system, user = prompts.build_revise_prompt(current_plan, city, days, feedback)
    try:
        raw = _generate(
            system,
            user,
            title="攻略调整",
            max_tokens=config.MAX_TOKENS_REVISE,
            show_full=False,
            silent=silent,
        )
        display = extract_display_revision(raw)
        if not silent:
            formatter.print_section("攻略调整", display)
        updated_plan = extract_updated_plan(raw, current_plan)
        city, days = update_meta(city, days, feedback)
        return updated_plan, city, days
    except RuntimeError as exc:
        if not silent:
            formatter.print_error(str(exc))
        raise


def run_detail_qa(
    current_plan: str, city: str, days: int, question: str, *, silent: bool = False
) -> str:
    """细节追问：只答局部问题，不更新完整攻略。"""
    system, user = prompts.build_detail_qa_prompt(current_plan, city, days, question)
    try:
        return _generate(
            system,
            user,
            title="细节解答",
            max_tokens=config.MAX_TOKENS_DETAIL_QA,
            show_full=not silent,
            silent=silent,
        )
    except RuntimeError as exc:
        if not silent:
            formatter.print_error(str(exc))
        raise


def run_merge_to_plan(
    current_plan: str,
    city: str,
    days: int,
    merge_request: str,
    content_to_merge: str,
    *,
    silent: bool = False,
) -> Tuple[str, str, int, str]:
    """
    将细节回答合并进完整攻略。

    Returns:
        (updated_plan, city, days, display_text)
    """
    system, user = prompts.build_merge_prompt(
        current_plan, city, days, merge_request, content_to_merge
    )
    try:
        raw = _generate(
            system,
            user,
            title="合并攻略",
            max_tokens=config.MAX_TOKENS_MERGE,
            show_full=False,
            silent=silent,
        )
        display = extract_display_revision(raw)
        if not silent:
            formatter.print_section("合并说明", display)
        updated_plan = extract_updated_plan(raw, current_plan)
        return updated_plan, city, days, display or "已将内容合并进完整攻略。"
    except RuntimeError as exc:
        if not silent:
            formatter.print_error(str(exc))
        raise
