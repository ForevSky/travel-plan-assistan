"""Web 平台启动入口。

开发模式：
    uvicorn backend.web.api.app:app --reload --port 8000

生产模式（需先构建前端）：
    cd frontend && npm run build
    uvicorn backend.web.api.app:app --host 0.0.0.0 --port 8000
"""

import os

import uvicorn


def main() -> None:
    reload = os.getenv("UVICORN_RELOAD", "1") != "0"
    uvicorn.run(
        "backend.web.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=reload,
    )


if __name__ == "__main__":
    main()
