"""Web 聊天编排：复用 CLI 业务逻辑，支持 SSE 流式输出。"""

import json
from typing import Dict, Generator, Tuple

from backend.core import config, llm_client, prompts
from backend.domain import domain_guard, intent_parser, validator
from backend.fallback import local_data
from backend.services import export_service, plan_service
from backend.web.api import store


def _auto_title(city: str, days: int) -> str:
    if city and days:
        return f"{city}{days}日游"
    if city:
        return f"{city}旅行"
    return "新对话"


def _split_error(message: str) -> Tuple[str, str]:
    if "\n" in message:
        parts = message.split("\n", 1)
        return parts[0], parts[1]
    return message, ""


def _sse(event: str, data: Dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _yield_plan_tail_after_marker(
    buffer: str, marker: str
) -> Generator[str, None, None]:
    """流式展示修订摘要后，补发完整攻略正文。"""
    if marker not in buffer:
        return
    plan_part = buffer.split(marker, 1)[1].strip()
    if plan_part:
        yield _sse("delta", {"content": "\n\n" + plan_part})


def process_message_stream(conv_id: str, user_input: str) -> Generator[str, None, None]:
    """SSE 流式处理用户消息。"""
    conv = store.get_conversation(conv_id)
    if not conv:
        yield _sse("error", {"message": "会话不存在"})
        return

    user_input = user_input.strip()
    if not user_input:
        yield _sse("error", {"message": "消息不能为空"})
        return

    user_msg = store.add_message(conv_id, "user", user_input)
    yield _sse("user_message", user_msg)

    plan = conv.get("plan", "")
    city = conv.get("city", "")
    days = int(conv.get("days", 0))
    has_plan = bool(plan.strip())

    if has_plan and validator.is_save_request(user_input):
        try:
            path = export_service.save(plan, city, days)
            filename = export_service.filename_from_path(path)
            reply = f"攻略已保存至：storage/output/{filename}"
        except ValueError as exc:
            reply = str(exc)
        assistant_msg = store.add_message(conv_id, "assistant", reply)
        yield _sse("delta", {"content": reply})
        yield _sse(
            "done",
            _done_payload(user_msg, assistant_msg, has_plan, city, days),
        )
        return

    if has_plan:
        err = domain_guard.validate_followup(user_input)
    else:
        err = domain_guard.validate_new_request(user_input)

    if err:
        main, guide = _split_error(err)
        reply = main if not guide else f"{main}\n\n{guide}"
        assistant_msg = store.add_message(conv_id, "assistant", reply)
        yield _sse("delta", {"content": reply})
        yield _sse(
            "done",
            _done_payload(user_msg, assistant_msg, has_plan, city, days),
        )
        return

    try:
        if has_plan:
            yield _sse("status", {"text": "正在理解您的意图..."})
            mode = domain_guard.classify_followup(user_input, city, days)
            if mode == "detail_qa":
                yield from _stream_detail_qa(
                    conv_id, user_msg, plan, city, days, user_input
                )
            elif mode == "merge_to_plan":
                yield from _stream_merge_to_plan(
                    conv_id, user_msg, plan, city, days, user_input
                )
            elif mode == "plan_revise":
                yield from _stream_revise(
                    conv_id, user_msg, plan, city, days, user_input
                )
            else:
                yield from _stream_natural(conv_id, user_msg, user_input)
        else:
            yield from _stream_natural(conv_id, user_msg, user_input)
    except ValueError as exc:
        msg = str(exc)
        if config.DOMAIN_REJECT_MESSAGE in msg:
            main, guide = _split_error(msg)
            reply = main if not guide else f"{main}\n\n{guide}"
        else:
            reply = msg
        assistant_msg = store.add_message(conv_id, "assistant", reply)
        yield _sse("delta", {"content": reply})
        yield _sse(
            "done",
            _done_payload(user_msg, assistant_msg, has_plan, city, days),
        )
    except RuntimeError as exc:
        assistant_msg = store.add_message(conv_id, "assistant", str(exc))
        yield _sse("delta", {"content": str(exc)})
        yield _sse(
            "done",
            _done_payload(user_msg, assistant_msg, has_plan, city, days),
        )
    except Exception as exc:
        reply = f"处理失败：{exc}"
        assistant_msg = store.add_message(conv_id, "assistant", reply)
        yield _sse("error", {"message": reply})
        yield _sse(
            "done",
            _done_payload(user_msg, assistant_msg, has_plan, city, days),
        )


def _stream_natural(
    conv_id: str, user_msg: Dict, user_input: str
) -> Generator[str, None, None]:
    yield _sse("status", {"text": "正在理解您的需求..."})

    city, days, err = intent_parser.parse(user_input, silent=True)
    if err:
        raise ValueError(err)

    yield _sse("status", {"text": f"已识别：{city}，{days} 天，正在生成攻略..."})

    system, user = prompts.build_full_plan_prompt(city, days, user_input)
    chunks: list[str] = []
    try:
        for delta in llm_client.chat_stream(system, user):
            chunks.append(delta)
            yield _sse("delta", {"content": delta})
    except RuntimeError:
        fallback = local_data.get_fallback(city or "")
        chunks = [fallback]
        yield _sse("status", {"text": "API 不可用，已切换本地兜底模板..."})
        yield _sse("delta", {"content": fallback})

    plan = "".join(chunks).strip()
    title = _auto_title(city, days)
    store.update_session_state(conv_id, plan, city, days, title=title)
    assistant_msg = store.add_message(conv_id, "assistant", plan)
    yield _sse(
        "done",
        _done_payload(user_msg, assistant_msg, True, city, days, title=title),
    )


def _get_previous_assistant_content(conv_id: str) -> str:
    """获取上一轮助手回复（用于合并进攻略）。"""
    conv = store.get_conversation(conv_id)
    if not conv:
        return ""
    messages = conv.get("messages", [])
    if messages and messages[-1]["role"] == "user":
        messages = messages[:-1]
    for msg in reversed(messages):
        if msg.get("role") != "assistant":
            continue
        content = str(msg.get("content", "")).strip()
        if content.startswith("攻略已保存"):
            continue
        return content
    return ""


def _stream_detail_qa(
    conv_id: str,
    user_msg: Dict,
    plan: str,
    city: str,
    days: int,
    question: str,
) -> Generator[str, None, None]:
    yield _sse("status", {"text": "正在整理针对性建议..."})

    system, user = prompts.build_detail_qa_prompt(plan, city, days, question)
    chunks: list[str] = []
    for delta in llm_client.chat_stream(
        system, user, max_tokens=config.MAX_TOKENS_DETAIL_QA
    ):
        chunks.append(delta)
        yield _sse("delta", {"content": delta})

    reply = "".join(chunks).strip()
    reply += (
        "\n\n---\n"
        "> 如需将以上内容写入完整攻略，请回复「写进攻略」或「合并到攻略」。"
    )
    assistant_msg = store.add_message(conv_id, "assistant", reply)
    yield _sse(
        "done",
        _done_payload(user_msg, assistant_msg, True, city, days),
    )


def _stream_merge_to_plan(
    conv_id: str,
    user_msg: Dict,
    plan: str,
    city: str,
    days: int,
    merge_request: str,
) -> Generator[str, None, None]:
    content_to_merge = _get_previous_assistant_content(conv_id)
    if not content_to_merge:
        content_to_merge = "（用户未提供可合并的上一轮细节内容，请根据其描述合并）"

    yield _sse("status", {"text": "正在合并到完整攻略..."})

    system, user = prompts.build_merge_prompt(
        plan, city, days, merge_request, content_to_merge
    )
    marker = config.UPDATED_PLAN_MARKER
    buffer = ""
    yielded_len = 0

    for delta in llm_client.chat_stream(
        system, user, max_tokens=config.MAX_TOKENS_MERGE
    ):
        buffer += delta
        visible = buffer.split(marker, 1)[0] if marker in buffer else buffer
        new_content = visible[yielded_len:]
        if new_content:
            yield _sse("delta", {"content": new_content})
            yielded_len += len(new_content)

    raw = buffer.strip()
    updated_plan = plan_service.extract_updated_plan(raw, plan)
    yield from _yield_plan_tail_after_marker(buffer, marker)

    reply = updated_plan
    reply += "\n\n> 完整攻略已更新，点击「导出攻略」可保存最新版本。"

    title = _auto_title(city, days)
    store.update_session_state(conv_id, updated_plan, city, days, title=title)
    assistant_msg = store.add_message(conv_id, "assistant", reply)
    yield _sse(
        "done",
        _done_payload(user_msg, assistant_msg, True, city, days, title=title),
    )


def _stream_revise(
    conv_id: str,
    user_msg: Dict,
    plan: str,
    city: str,
    days: int,
    feedback: str,
) -> Generator[str, None, None]:
    yield _sse("status", {"text": "正在调整攻略..."})

    system, user = prompts.build_revise_prompt(plan, city, days, feedback)
    marker = config.UPDATED_PLAN_MARKER
    buffer = ""
    yielded_len = 0

    for delta in llm_client.chat_stream(
        system, user, max_tokens=config.MAX_TOKENS_REVISE
    ):
        buffer += delta
        visible = buffer.split(marker, 1)[0] if marker in buffer else buffer
        new_content = visible[yielded_len:]
        if new_content:
            yield _sse("delta", {"content": new_content})
            yielded_len += len(new_content)

    raw = buffer.strip()
    updated_plan = plan_service.extract_updated_plan(raw, plan)
    city, days = plan_service.update_meta(city, days, feedback)
    yield from _yield_plan_tail_after_marker(buffer, marker)

    reply = updated_plan

    title = _auto_title(city, days)
    store.update_session_state(conv_id, updated_plan, city, days, title=title)
    assistant_msg = store.add_message(conv_id, "assistant", reply)
    yield _sse(
        "done",
        _done_payload(user_msg, assistant_msg, True, city, days, title=title),
    )


def export_plan(conv_id: str) -> Tuple[str, str]:
    """返回 (文件名, 用户可读消息)。"""
    conv = store.get_conversation(conv_id)
    if not conv:
        raise ValueError("会话不存在")
    path = export_service.save(
        conv.get("plan", ""), conv.get("city", ""), int(conv.get("days", 0))
    )
    filename = export_service.filename_from_path(path)
    return filename, f"攻略已保存至 storage/output/{filename}"


def _done_payload(
    user_msg: Dict,
    assistant_msg: Dict,
    has_plan: bool,
    city: str,
    days: int,
    *,
    title: str = "",
) -> Dict:
    payload = {
        "user_message": user_msg,
        "assistant_message": assistant_msg,
        "has_plan": has_plan,
        "city": city,
        "days": days,
    }
    if title:
        payload["title"] = title
    return payload
