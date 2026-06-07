"""
应用配置与业务常量。

分层说明：
- 环境变量：DeepSeek API 连接参数
- 业务常量：行程天数、领域词库等可运营配置项
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# 路径与环境变量
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"
OUTPUT_DIR = STORAGE_DIR / "output"
DATA_DIR = STORAGE_DIR / "data"

load_dotenv(BASE_DIR / ".env")

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip()
PLACEHOLDER_API_KEY = "sk-your-api-key-here"

# ---------------------------------------------------------------------------
# LLM 调用参数
# ---------------------------------------------------------------------------
MAX_TOKENS_PARSE = 200
MAX_TOKENS_FULL_PLAN = 2500
MAX_TOKENS_REVISE = 3500
MAX_TOKENS_DETAIL_QA = 1500
MAX_TOKENS_MERGE = 3500
MAX_TOKENS_INTENT = 120
REQUEST_TIMEOUT = 60
MAX_RETRIES = 2
USE_LLM_FOLLOWUP_CLASSIFIER = True

# ---------------------------------------------------------------------------
# 业务规则常量
# ---------------------------------------------------------------------------
MIN_TRIP_DAYS = 1
MAX_TRIP_DAYS = 7
MAX_CITY_NAME_LEN = 20
MAX_PLAN_CONTEXT_CHARS = 10000
UPDATED_PLAN_MARKER = "【完整攻略（更新版）】"

# 显式新行程关键词（命中则走重新规划，而非追问修订）
REPLAN_KEYWORDS = (
    "改去", "换成", "改为", "重新规划", "重新计划", "换个城市", "换城市",
)

# 追问修订关键词（要求改动既有攻略结构时使用）
PLAN_REVISE_KEYWORDS = (
    "不去", "不想去", "删掉", "去掉", "少去", "换酒店", "换景点", "增加", "再加",
    "减少", "轻松", "紧凑", "换一下", "调整", "修改", "改行程", "改方案",
    "便宜", "贵", "重新安排", "换一天", "挪到", "提前", "推后",
)

# 细节追问关键词（只答局部，不重出完整攻略）
DETAIL_QA_KEYWORDS = (
    "有什么", "哪些", "推荐什么", "推荐哪些", "推荐一下", "推荐点",
    "小吃", "美食", "特产", "吃什么", "好吃", "餐厅", "饭店", "饮品",
    "天气", "穿衣", "带什么", "必备", "冷不冷", "热不热", "下雨",
    "怎么去", "怎么走", "交通", "地铁", "公交", "打车", "停车",
    "开放时间", "几点", "关门", "门票", "收费", "价格", "多少钱",
    "值得", "有必要", "介绍", "讲讲", "说说", "详解", "是什么",
    "注意", "提醒", "建议", "附近", "周边", "购物", "伴手礼",
)

# 合并进攻略关键词（将上一轮细节回答写入完整攻略）
MERGE_TO_PLAN_KEYWORDS = (
    "写进攻略", "加入攻略", "合并到攻略", "更新到攻略", "同步到攻略",
    "记入攻略", "纳入行程", "加到规划", "写入规划", "更新规划",
    "加进行程", "合并进", "写入行程", "就这些", "按这个更新",
    "刚才的", "上面的", "把它加进去", "补充进", "整合进",
)

# ---------------------------------------------------------------------------
# 旅行垂直领域词库（可按运营需要扩展）
# ---------------------------------------------------------------------------
TRAVEL_KEYWORDS = (
    "旅行", "旅游", "游玩", "出游", "出行", "攻略", "行程", "规划",
    "景点", "景区", "酒店", "民宿", "宾馆", "美食", "小吃", "门票",
    "预约", "预算", "日游", "天游", "自驾", "徒步", "古镇", "海滨",
    "风景", "打卡", "交通", "住宿", "餐饮", "人均", "亲子", "情侣",
    "天气", "季节", "下雨", "气温", "穿衣", "防晒", "带伞", "冷不冷", "热不热",
)

OFF_TOPIC_KEYWORDS = (
    "写代码", "编程", "python", "java", "javascript", "股票", "炒股",
    "期货", "基金", "比特币", "区块链", "数学题", "物理题", "化学题",
    "写作业", "写作文", "翻译", "讲笑话", "你是谁", "什么模型", "chatgpt",
    "恋爱", "感情", "医疗", "诊断", "律师", "法律文书", "政治",
)

DOMAIN_REJECT_MESSAGE = "本助手专注于旅行规划，无法回答与旅游出行无关的问题。"
DOMAIN_GUIDE = "请描述您的旅行需求，例如：我想去成都玩3天，想吃火锅看熊猫"


def ensure_api_key() -> None:
    """启动自检：API Key 缺失则终止进程。"""
    if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY == PLACEHOLDER_API_KEY:
        print("错误：未配置 DEEPSEEK_API_KEY。")
        print("请复制 .env.example 为 .env，并填入你的 DeepSeek API 密钥。")
        sys.exit(1)


def ensure_output_dir() -> Path:
    """确保导出目录存在。"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR
