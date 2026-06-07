"""分享 REST 路由。"""

from fastapi import APIRouter, HTTPException

from backend.web.api.schemas import ShareCreateResponse, ShareDetail
from backend.web.services import share_service

router = APIRouter(prefix="/api", tags=["share"])


def _raise_share_error(exc: ValueError) -> None:
    msg = str(exc)
    status = 404 if "不存在" in msg or "无效" in msg or "已失效" in msg else 400
    raise HTTPException(status_code=status, detail=msg) from exc


@router.post(
    "/conversations/{conv_id}/share",
    response_model=ShareCreateResponse,
)
def share_conversation(conv_id: str):
    try:
        token = share_service.create_conversation_share(conv_id)
        return ShareCreateResponse(token=token)
    except ValueError as exc:
        _raise_share_error(exc)


@router.post(
    "/conversations/{conv_id}/messages/{msg_id}/share",
    response_model=ShareCreateResponse,
)
def share_plan_message(conv_id: str, msg_id: str):
    try:
        token = share_service.create_plan_share(conv_id, msg_id)
        return ShareCreateResponse(token=token)
    except ValueError as exc:
        _raise_share_error(exc)


@router.get("/share/{token}", response_model=ShareDetail)
def get_share(token: str):
    try:
        return share_service.get_share_payload(token)
    except ValueError as exc:
        _raise_share_error(exc)
