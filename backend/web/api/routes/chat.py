"""聊天 REST 路由。"""

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.web.api.schemas import ExportResponse, SendMessageRequest
from backend.web.services import chat_service

router = APIRouter(prefix="/api/conversations", tags=["chat"])


@router.post("/{conv_id}/messages/stream")
def send_message_stream(conv_id: str, body: SendMessageRequest):
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    def event_stream():
        try:
            yield from chat_service.process_message_stream(conv_id, body.content)
        except Exception as exc:
            payload = json.dumps({"message": f"服务异常：{exc}"}, ensure_ascii=False)
            yield f"event: error\ndata: {payload}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{conv_id}/export", response_model=ExportResponse)
def export_conversation(conv_id: str):
    try:
        filename, message = chat_service.export_plan(conv_id)
        return ExportResponse(filepath=filename, message=message)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
