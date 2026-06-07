"""从 LLM 原始输出中提取 JSON 对象的通用工具。"""

import json
import re
from typing import Any, Dict, Optional


def extract_json(raw: str) -> Optional[Dict[str, Any]]:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            return None
    return None
