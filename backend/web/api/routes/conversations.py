"""会话 REST 路由。"""

from fastapi import APIRouter, HTTPException

from backend.web.api import store
from backend.web.api.schemas import (
    ConversationDetail,
    ConversationSummary,
    CreateConversationRequest,
    UpdateConversationRequest,
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationSummary])
def list_conversations():
    return store.list_conversations()


@router.post("", response_model=ConversationDetail, status_code=201)
def create_conversation(body: CreateConversationRequest):
    conv = store.create_conversation(body.title)
    return conv


@router.get("/{conv_id}", response_model=ConversationDetail)
def get_conversation(conv_id: str):
    conv = store.get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")
    return conv


@router.patch("/{conv_id}", response_model=ConversationDetail)
def update_conversation(conv_id: str, body: UpdateConversationRequest):
    conv = store.update_conversation_title(conv_id, body.title)
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")
    return conv


@router.delete("/{conv_id}", status_code=204)
def delete_conversation(conv_id: str):
    if not store.delete_conversation(conv_id):
        raise HTTPException(status_code=404, detail="会话不存在")
