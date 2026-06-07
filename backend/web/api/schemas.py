"""Web API 请求/响应模型。"""

from typing import List, Optional

from pydantic import BaseModel, Field


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    has_plan: bool = False


class ConversationDetail(ConversationSummary):
    messages: List[MessageOut] = Field(default_factory=list)
    city: str = ""
    days: int = 0


class CreateConversationRequest(BaseModel):
    title: str = "新对话"


class UpdateConversationRequest(BaseModel):
    title: str


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


class ExportResponse(BaseModel):
    filepath: str
    message: str


class ShareCreateResponse(BaseModel):
    token: str


class ShareDetail(BaseModel):
    token: str
    share_type: str
    title: str
    city: str = ""
    days: int = 0
    created_at: str
    content: Optional[str] = None
    message_id: Optional[str] = None
    user_message: Optional[MessageOut] = None
    messages: Optional[List[MessageOut]] = None
