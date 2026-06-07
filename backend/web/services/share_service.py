"""分享链接服务。"""

from typing import Dict

from backend.web.api import store

_PLAN_MARKERS = ("行程概览", "每日路线", "一、", "二、", "Day 1", "Day1")


def is_plan_content(content: str) -> bool:
    text = content.strip()
    if len(text) < 200:
        return False
    hits = sum(1 for marker in _PLAN_MARKERS if marker in text)
    return hits >= 2


def create_conversation_share(conv_id: str) -> str:
    conv = store.get_conversation(conv_id)
    if not conv:
        raise ValueError("会话不存在")
    if not conv.get("has_plan"):
        raise ValueError("当前会话尚无完整攻略，无法分享")
    return store.create_share(conv_id, "conversation")


def create_plan_share(conv_id: str, message_id: str) -> str:
    conv = store.get_conversation(conv_id)
    if not conv:
        raise ValueError("会话不存在")

    msg = store.get_message(conv_id, message_id)
    if not msg:
        raise ValueError("消息不存在")
    if msg.get("role") != "assistant":
        raise ValueError("只能分享助手生成的攻略")
    if not is_plan_content(str(msg.get("content", ""))):
        raise ValueError("该消息不是完整攻略，无法分享")

    return store.create_share(conv_id, "plan", message_id=message_id)


def get_share_payload(token: str) -> Dict:
    share = store.get_share(token)
    if not share:
        raise ValueError("分享链接无效或已失效")

    conv = share["conversation"]
    base = {
        "token": share["token"],
        "share_type": share["share_type"],
        "title": conv.get("title", "旅行攻略"),
        "city": conv.get("city", ""),
        "days": int(conv.get("days", 0)),
        "created_at": share["created_at"],
    }

    if share["share_type"] == "plan":
        msg = share.get("message")
        if not msg:
            raise ValueError("分享的攻略不存在")
        base["content"] = msg["content"]
        base["message_id"] = msg["id"]
        user_msg = share.get("user_message")
        if user_msg:
            base["user_message"] = user_msg
    else:
        if not share.get("has_plan"):
            raise ValueError("会话尚无完整攻略")
        base["messages"] = share.get("messages", [])

    return base
