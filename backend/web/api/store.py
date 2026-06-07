"""会话与消息持久化（SQLite）。"""

import sqlite3
import uuid
import secrets
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Dict, List, Optional

from backend.core import config

DB_PATH = config.DATA_DIR / "conversations.db"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


@contextmanager
def _connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                plan TEXT NOT NULL DEFAULT '',
                city TEXT NOT NULL DEFAULT '',
                days INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_messages_conv
                ON messages(conversation_id, created_at);
            CREATE TABLE IF NOT EXISTS shares (
                token TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                message_id TEXT,
                share_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_shares_conv
                ON shares(conversation_id);
            """
        )


def list_conversations() -> List[Dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, created_at, updated_at,
                   CASE WHEN TRIM(plan) != '' THEN 1 ELSE 0 END AS has_plan
            FROM conversations
            ORDER BY updated_at DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def create_conversation(title: str = "新对话") -> Dict:
    conv_id = _new_id()
    now = _now_iso()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO conversations (id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (conv_id, title.strip() or "新对话", now, now),
        )
    return get_conversation(conv_id)


def get_conversation(conv_id: str) -> Optional[Dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (conv_id,)
        ).fetchone()
        if not row:
            return None
        messages = conn.execute(
            """
            SELECT id, role, content, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            """,
            (conv_id,),
        ).fetchall()
    data = dict(row)
    data["messages"] = [dict(m) for m in messages]
    data["has_plan"] = bool(data.get("plan", "").strip())
    return data


def update_conversation_title(conv_id: str, title: str) -> Optional[Dict]:
    now = _now_iso()
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title.strip() or "新对话", now, conv_id),
        )
        if cur.rowcount == 0:
            return None
    return get_conversation(conv_id)


def delete_conversation(conv_id: str) -> bool:
    with _connect() as conn:
        conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
        cur = conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
        return cur.rowcount > 0


def update_session_state(
    conv_id: str, plan: str, city: str, days: int, title: Optional[str] = None
) -> None:
    now = _now_iso()
    with _connect() as conn:
        if title:
            conn.execute(
                """
                UPDATE conversations
                SET plan = ?, city = ?, days = ?, title = ?, updated_at = ?
                WHERE id = ?
                """,
                (plan, city, days, title, now, conv_id),
            )
        else:
            conn.execute(
                """
                UPDATE conversations
                SET plan = ?, city = ?, days = ?, updated_at = ?
                WHERE id = ?
                """,
                (plan, city, days, now, conv_id),
            )


def add_message(conv_id: str, role: str, content: str) -> Dict:
    msg_id = _new_id()
    now = _now_iso()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM conversations WHERE id = ?", (conv_id,)
        ).fetchone()
        if not row:
            raise ValueError("会话不存在")
        conn.execute(
            """
            INSERT INTO messages (id, conversation_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (msg_id, conv_id, role, content, now),
        )
        conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (now, conv_id),
        )
    return {"id": msg_id, "role": role, "content": content, "created_at": now}


def get_message(conv_id: str, msg_id: str) -> Optional[Dict]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT id, role, content, created_at
            FROM messages
            WHERE conversation_id = ? AND id = ?
            """,
            (conv_id, msg_id),
        ).fetchone()
    return dict(row) if row else None


def get_user_message_before(conv_id: str, message_id: str) -> Optional[Dict]:
    """获取指定消息之前最近一条用户消息。"""
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, role, content, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            """,
            (conv_id,),
        ).fetchall()

    messages = [dict(r) for r in rows]
    target_idx = next((i for i, m in enumerate(messages) if m["id"] == message_id), None)
    if target_idx is None:
        return None

    for i in range(target_idx - 1, -1, -1):
        if messages[i]["role"] == "user":
            return messages[i]
    return None


def create_share(
    conv_id: str, share_type: str, message_id: Optional[str] = None
) -> str:
    token = secrets.token_urlsafe(12)
    now = _now_iso()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM conversations WHERE id = ?", (conv_id,)
        ).fetchone()
        if not row:
            raise ValueError("会话不存在")
        conn.execute(
            """
            INSERT INTO shares (token, conversation_id, message_id, share_type, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (token, conv_id, message_id, share_type, now),
        )
    return token


def get_share(token: str) -> Optional[Dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM shares WHERE token = ?", (token,)
        ).fetchone()
        if not row:
            return None
        conv = conn.execute(
            "SELECT * FROM conversations WHERE id = ?",
            (row["conversation_id"],),
        ).fetchone()
        if not conv:
            return None

        share = dict(row)
        conv_data = dict(conv)
        share["conversation"] = conv_data
        share["has_plan"] = bool(str(conv_data.get("plan", "")).strip())

        if share["share_type"] == "plan" and share["message_id"]:
            msg = conn.execute(
                """
                SELECT id, role, content, created_at
                FROM messages
                WHERE id = ? AND conversation_id = ?
                """,
                (share["message_id"], share["conversation_id"]),
            ).fetchone()
            share["message"] = dict(msg) if msg else None
            if msg:
                user_msg = get_user_message_before(
                    share["conversation_id"], share["message_id"]
                )
                share["user_message"] = user_msg
        else:
            messages = conn.execute(
                """
                SELECT id, role, content, created_at
                FROM messages
                WHERE conversation_id = ?
                ORDER BY created_at ASC
                """,
                (share["conversation_id"],),
            ).fetchall()
            share["messages"] = [dict(m) for m in messages]

    return share
