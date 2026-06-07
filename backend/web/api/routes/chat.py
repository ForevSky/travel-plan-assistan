"""聊天 REST 路由。"""

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.web.api.schemas import ExportResponse, SendMessageRequest
from backend.web.services import chat_service
from backend.web.services import generation_registry

router = APIRouter(prefix="/api/conversations", tags=["chat"])


def _stream_response(job) -> StreamingResponse:
    def event_stream():
        try:
            yield from generation_registry.subscribe(job)
        except GeneratorExit:
            pass
        finally:
            generation_registry.cleanup(job.conv_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{conv_id}/messages/stream")
def send_message_stream(conv_id: str, body: SendMessageRequest):
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    job = generation_registry.start(conv_id, body.content.strip())
    return _stream_response(job)


@router.get("/{conv_id}/messages/stream")
def reconnect_message_stream(conv_id: str):
    """续订进行中的生成流（切换对话后返回时使用）。"""
    job = generation_registry.get_active(conv_id)
    if not job:
        raise HTTPException(status_code=404, detail="无进行中的生成")
    return _stream_response(job)


@router.post("/{conv_id}/export", response_model=ExportResponse)
def export_conversation(conv_id: str):
    try:
        filename, message = chat_service.export_plan(conv_id)
        return ExportResponse(filepath=filename, message=message)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
