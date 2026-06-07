"""FastAPI 应用入口。"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from backend.core import config
from backend.web.api import store
from backend.web.api.routes import chat, conversations, share

FRONTEND_DIST = config.BASE_DIR / "frontend" / "dist"


class SPAMiddleware(BaseHTTPMiddleware):
    """前端 SPA 回退：仅对 GET 且非 /api 的 404 返回 index.html。"""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if request.method == "GET" and not path.startswith("/api"):
            rel = path.lstrip("/")
            if rel:
                dist_root = FRONTEND_DIST.resolve()
                file_path = (dist_root / rel).resolve()
                if (
                    file_path.is_relative_to(dist_root)
                    and file_path.is_file()
                ):
                    return FileResponse(file_path)

        response = await call_next(request)

        if (
            response.status_code == 404
            and request.method == "GET"
            and not path.startswith("/api")
            and not path.startswith("/assets")
        ):
            index = FRONTEND_DIST / "index.html"
            if index.is_file():
                return FileResponse(index)

        return response


app = FastAPI(
    title="旅行规划小助手",
    description="企业级旅行规划 Web 平台",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conversations.router)
app.include_router(chat.router)
app.include_router(share.router)


@app.on_event("startup")
def on_startup():
    store.init_db()
    config.ensure_api_key()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "travel-plan-assistant"}


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    app.add_middleware(SPAMiddleware)
