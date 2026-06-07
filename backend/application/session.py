"""会话状态：单次 CLI 运行期间的用户上下文。"""

from dataclasses import dataclass


@dataclass
class TravelSession:
    """
    旅行规划会话上下文。

    业务含义：
    - plan：当前完整攻略文本（含追问修订后的最新版）
    - city / days：导出文件名与后续修订的基准元数据
    """

    plan: str = ""
    city: str = ""
    days: int = 0

    @property
    def has_plan(self) -> bool:
        """是否已生成有效攻略（决定进入追问态或首规划态）。"""
        return bool(self.plan.strip())

    def update_plan(self, plan: str, city: str, days: int) -> None:
        """更新会话中的攻略与元数据。"""
        self.plan = plan
        self.city = city
        self.days = days
