"""
LLM 基础设施层：DeepSeek API 统一网关。

职责：
- 封装 OpenAI 兼容协议调用
- 统一重试、超时、错误文案
- 禁止在业务层散落 SDK 调用
"""

import time
from typing import Generator, Optional

from openai import APIConnectionError, APIStatusError, OpenAI, RateLimitError

from backend.core import config
from backend.presentation import formatter

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=config.DEEPSEEK_API_KEY,
            base_url=config.DEEPSEEK_BASE_URL,
            timeout=config.REQUEST_TIMEOUT,
        )
    return _client


def _format_api_error(exc: Exception) -> str:
    if isinstance(exc, APIStatusError):
        status = exc.status_code
        if status in (401, 403):
            return "API 密钥无效或无权访问，请检查 .env 中的 DEEPSEEK_API_KEY"
        if status == 429:
            return "API 请求过于频繁（限流），请稍后重试"
        return f"API 返回错误（HTTP {status}），请稍后重试"
    if isinstance(exc, RateLimitError):
        return "API 请求过于频繁（限流），请稍后重试"
    if isinstance(exc, APIConnectionError):
        return "网络连接异常，请检查网络后重试"
    return f"调用失败：{exc}"


def chat(
    system: str,
    user: str,
    *,
    temperature: float = 0.7,
    max_tokens: int = config.MAX_TOKENS_FULL_PLAN,
    silent: bool = False,
) -> str:
    """
    调用 DeepSeek Chat Completions。

    Raises:
        RuntimeError: 重试耗尽或模型返回空内容
    """
    client = _get_client()
    last_error = "未知错误"

    for attempt in range(config.MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=config.DEEPSEEK_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = response.choices[0].message.content
            if not content or not content.strip():
                last_error = "模型返回空内容，请重试"
                if attempt < config.MAX_RETRIES:
                    time.sleep(1)
                    continue
                raise RuntimeError(last_error)
            return content.strip()
        except (APIStatusError, RateLimitError, APIConnectionError) as exc:
            last_error = _format_api_error(exc)
            if attempt < config.MAX_RETRIES:
                if not silent:
                    formatter.print_info(
                        f"正在重试（{attempt + 1}/{config.MAX_RETRIES}）..."
                    )
                time.sleep(1)
                continue
            raise RuntimeError(last_error) from exc
        except Exception as exc:
            last_error = _format_api_error(exc)
            if attempt < config.MAX_RETRIES:
                time.sleep(1)
                continue
            raise RuntimeError(last_error) from exc

    raise RuntimeError(last_error)


def chat_stream(
    system: str,
    user: str,
    *,
    temperature: float = 0.7,
    max_tokens: int = config.MAX_TOKENS_FULL_PLAN,
) -> Generator[str, None, None]:
    """流式调用 DeepSeek Chat Completions，逐块 yield 文本。"""
    client = _get_client()
    last_error = "未知错误"

    for attempt in range(config.MAX_RETRIES + 1):
        try:
            stream = client.chat.completions.create(
                model=config.DEEPSEEK_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            has_content = False
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    has_content = True
                    yield delta
            if not has_content:
                last_error = "模型返回空内容，请重试"
                if attempt < config.MAX_RETRIES:
                    time.sleep(1)
                    continue
                raise RuntimeError(last_error)
            return
        except (APIStatusError, RateLimitError, APIConnectionError) as exc:
            last_error = _format_api_error(exc)
            if attempt < config.MAX_RETRIES:
                time.sleep(1)
                continue
            raise RuntimeError(last_error) from exc
        except RuntimeError:
            raise
        except Exception as exc:
            last_error = _format_api_error(exc)
            if attempt < config.MAX_RETRIES:
                time.sleep(1)
                continue
            raise RuntimeError(last_error) from exc

    raise RuntimeError(last_error)
