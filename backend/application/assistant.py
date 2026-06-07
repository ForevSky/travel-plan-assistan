"""
旅行规划助手 - 应用编排层。

职责：串联「表现层 → 领域校验 → 业务服务」，不含具体 AI/Prompt 实现。

交互状态机（简化）：
    [首规划态] --生成成功--> [追问态] --Q--> [退出]
                    |              |
                    +-- 新行程 ----+-- Y/保存 --> 写文件
                                   +-- 追问 --> 最小范围修订
                                   +-- 离题 --> 拒答引导
"""

from backend.core import config
from backend.domain import domain_guard, validator
from backend.presentation import formatter
from backend.application.session import TravelSession
from backend.services import export_service, plan_service


class TravelAssistant:
    """CLI 旅行规划助手主控制器。"""

    def __init__(self) -> None:
        self._session = TravelSession()
        self._last_assistant_reply = ""

    def run(self) -> None:
        """启动交互主循环。"""
        config.ensure_api_key()
        formatter.print_banner()
        formatter.print_info(
            "提示：输出为 AI 规划建议，预约/收费/天气信息非实时查询，出行前请核实官方信息。"
        )
        while True:
            user_input = self._read_input()
            if self._should_exit(user_input):
                formatter.print_info("感谢使用，祝旅途愉快！")
                break
            if not user_input:
                self._prompt_empty_input()
                continue
            if self._try_save(user_input):
                continue
            if self._try_reject_off_topic(user_input):
                continue
            self._dispatch_planning(user_input)

    # ------------------------------------------------------------------
    # 表现层：读取用户输入
    # ------------------------------------------------------------------

    def _read_input(self) -> str:
        if self._session.has_plan:
            prompt = formatter.FOLLOWUP_PROMPT
        else:
            formatter.print_welcome_hint()
            prompt = "请输入旅行需求，输入 Q 退出："
        return input(prompt).strip()

    def _prompt_empty_input(self) -> None:
        hint = "请输入内容"
        if self._session.has_plan:
            hint += "，或输入 Y 保存"
        formatter.print_error(hint)

    def _should_exit(self, user_input: str) -> bool:
        return bool(user_input) and formatter.is_exit_command(user_input)

    # ------------------------------------------------------------------
    # 业务动作：保存 / 拒答
    # ------------------------------------------------------------------

    def _try_save(self, user_input: str) -> bool:
        """追问态下，Y 或「保存」触发文件导出。"""
        if not self._session.has_plan or not validator.is_save_request(user_input):
            return False
        try:
            path = export_service.save(
                self._session.plan, self._session.city, self._session.days
            )
            formatter.print_success(f"已保存至 {path}")
        except ValueError as exc:
            formatter.print_error(str(exc))
        return True

    def _try_reject_off_topic(self, user_input: str) -> bool:
        """
        垂直领域守门：非旅行问题拒答并引导。
        首规划态与追问态采用不同校验策略（见 domain_guard）。
        """
        if self._session.has_plan:
            err = domain_guard.validate_followup(user_input)
        else:
            err = domain_guard.validate_new_request(user_input)
        if err:
            formatter.print_domain_reject(err)
            return True
        return False

    # ------------------------------------------------------------------
    # 核心业务：新规划 / 追问修订
    # ------------------------------------------------------------------

    def _dispatch_planning(self, user_input: str) -> None:
        try:
            if self._session.has_plan:
                mode = domain_guard.classify_followup(
                    user_input, self._session.city, self._session.days
                )
                if mode == "detail_qa":
                    answer = plan_service.run_detail_qa(
                        self._session.plan,
                        self._session.city,
                        self._session.days,
                        user_input,
                    )
                    self._last_assistant_reply = answer
                    formatter.print_section("细节解答", answer)
                    return
                if mode == "merge_to_plan":
                    content = self._last_assistant_reply or "（请根据用户描述合并）"
                    updated, city, days, display = plan_service.run_merge_to_plan(
                        self._session.plan,
                        self._session.city,
                        self._session.days,
                        user_input,
                        content,
                    )
                    self._session.update_plan(updated, city, days)
                    self._last_assistant_reply = display
                    formatter.print_success("完整攻略已更新，可输入 Y 保存")
                    return
                if mode == "plan_revise":
                    plan, city, days = plan_service.run_revise(
                        self._session.plan,
                        self._session.city,
                        self._session.days,
                        user_input,
                    )
                    self._session.update_plan(plan, city, days)
                    self._last_assistant_reply = plan
                    return
            plan, city, days = plan_service.run_natural(user_input)
            self._session.update_plan(plan, city, days)
            self._last_assistant_reply = plan
        except ValueError as exc:
            self._handle_value_error(str(exc))
        except RuntimeError:
            # API 层已输出错误信息；保持会话状态，允许用户重试
            pass

    def _handle_value_error(self, message: str) -> None:
        """统一处理业务校验失败（含领域拒答、解析失败）。"""
        if config.DOMAIN_REJECT_MESSAGE in message:
            formatter.print_domain_reject(message)
            return
        if "\n" in message:
            formatter.print_error(message.split("\n", 1)[0])
            formatter.print_info(message.split("\n", 1)[1])
        else:
            formatter.print_error(message)
