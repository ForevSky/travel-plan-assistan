"""后台生成任务注册表：客户端断开后仍继续生成，支持 SSE 续订。"""

import json
import threading
from dataclasses import dataclass, field
from typing import Dict, Generator, List, Optional

from backend.web.services import chat_service


@dataclass
class GenerationJob:
    conv_id: str
    user_input: str
    events: List[str] = field(default_factory=list)
    active: bool = True
    status_text: str = ""
    assistant_content: str = ""
    user_message: Optional[Dict] = None
    done_payload: Optional[Dict] = None
    error: Optional[str] = None
    _condition: threading.Condition = field(default_factory=threading.Condition)
    _thread: Optional[threading.Thread] = field(default=None, repr=False)


_lock = threading.Lock()
_jobs: Dict[str, GenerationJob] = {}


def _parse_sse(sse: str) -> tuple[str, Dict]:
    event = "message"
    data = ""
    for line in sse.strip().split("\n"):
        if line.startswith("event:"):
            event = line[6:].strip()
        if line.startswith("data:"):
            data = line[5:].strip()
    return event, json.loads(data) if data else {}


def _update_job_state(job: GenerationJob, sse: str) -> None:
    try:
        event, payload = _parse_sse(sse)
    except (json.JSONDecodeError, ValueError):
        return

    if event == "user_message":
        job.user_message = payload
    elif event == "status":
        job.status_text = str(payload.get("text", ""))
    elif event == "delta":
        job.assistant_content += str(payload.get("content", ""))
        job.status_text = ""
    elif event == "done":
        job.done_payload = payload
        job.active = False
    elif event == "error":
        job.error = str(payload.get("message", ""))
        job.active = False


def _append_event(job: GenerationJob, sse: str) -> None:
    with job._condition:
        job.events.append(sse)
        _update_job_state(job, sse)
        job._condition.notify_all()


def _run_job(job: GenerationJob) -> None:
    try:
        for sse in chat_service.process_message_stream(job.conv_id, job.user_input):
            _append_event(job, sse)
    except Exception as exc:
        error_sse = (
            "event: error\n"
            f"data: {json.dumps({'message': f'服务异常：{exc}'}, ensure_ascii=False)}\n\n"
        )
        _append_event(job, error_sse)
    finally:
        with job._condition:
            if job.active:
                job.active = False
                job._condition.notify_all()


def start(conv_id: str, user_input: str) -> GenerationJob:
    """启动后台生成；同一会话若已在生成中则返回现有任务。"""
    with _lock:
        existing = _jobs.get(conv_id)
        if existing and existing.active:
            return existing

        job = GenerationJob(conv_id=conv_id, user_input=user_input)
        _jobs[conv_id] = job
        thread = threading.Thread(target=_run_job, args=(job,), daemon=True)
        job._thread = thread
        thread.start()
        return job


def get_active(conv_id: str) -> Optional[GenerationJob]:
    with _lock:
        job = _jobs.get(conv_id)
        if job and job.active:
            return job
        return None


def get_job(conv_id: str) -> Optional[GenerationJob]:
    with _lock:
        return _jobs.get(conv_id)


def is_generating(conv_id: str) -> bool:
    return get_active(conv_id) is not None


def subscribe(job: GenerationJob) -> Generator[str, None, None]:
    """从当前进度起订阅 SSE 事件；客户端断开不影响后台任务。"""
    index = 0
    while True:
        with job._condition:
            while index >= len(job.events) and job.active:
                job._condition.wait(timeout=1.0)
            batch = job.events[index:]
            index += len(batch)
            active = job.active

        for sse in batch:
            yield sse

        if not batch and not active:
            break


def cleanup(conv_id: str) -> None:
    with _lock:
        job = _jobs.get(conv_id)
        if job and not job.active:
            del _jobs[conv_id]
