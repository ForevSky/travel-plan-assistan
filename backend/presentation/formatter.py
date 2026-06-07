"""
表现层：CLI 输出格式化与用户提示文案。

仅负责展示，不包含业务决策逻辑。
"""

WIDTH = 40
LINE = "=" * WIDTH
DASH = "-" * WIDTH

EXIT_COMMANDS = frozenset({"q", "quit", "exit", "退出", "\x1b"})
FOLLOWUP_PROMPT = "是否保存到文件（Y），或直接继续追问（Q 退出）："


def print_banner() -> None:
    print(LINE)
    print("       旅行规划小助手 v1.0")
    print("       Powered by DeepSeek")
    print(LINE)


def print_welcome_hint() -> None:
    print()
    print("【输入说明】")
    print("  直接描述旅行需求，例如：")
    print("    1. 我想去威海玩3天")
    print("    2. 我想去成都玩3天，想吃火锅看熊猫")
    print("    3. 帮我规划杭州两日游，轻松一点")
    print("  输入 Q 退出程序")
    print(DASH)


def is_exit_command(text: str) -> bool:
    return text.strip().lower() in EXIT_COMMANDS or text.strip() == "\x1b"


def print_domain_reject(message: str) -> None:
    """展示领域拒答：首行错误提示 + 次行引导示例。"""
    if "\n" in message:
        print_error(message.split("\n", 1)[0])
        print_info(message.split("\n", 1)[1])
    else:
        print_error(message)


def print_section(title: str, content: str) -> None:
    print()
    print(f"【{title}】")
    print(DASH)
    print(content)
    print()


def print_error(message: str) -> None:
    print(f"错误：{message}")


def print_success(message: str) -> None:
    print(f"✓ {message}")


def print_info(message: str) -> None:
    print(message)
