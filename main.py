"""
旅行规划小助手 - 程序入口。

启动方式：python main.py
"""

from backend.application import TravelAssistant


def main() -> None:
    TravelAssistant().run()


if __name__ == "__main__":
    main()
