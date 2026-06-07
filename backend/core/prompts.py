"""
Prompt 模板层。

业务职责：集中管理 System / User Prompt，与代码逻辑解耦，便于运营调优。
所有生成须遵守：不查实时 API、预约收费单独汇总、路线地理顺路。
"""

from typing import Tuple

from backend.core import config

SYSTEM_PROMPT = """你是一名专业、务实的旅行规划师，仅服务【旅行规划】垂直领域。
你必须遵守以下规则：
0. 只处理与旅行出行相关的问题（行程、景点、美食、住宿、交通、预算、注意事项等）；若用户提问与旅行无关，必须拒答并引导其描述旅行需求。
1. 不查询任何实时 API；天气建议结合目的地与常见出行时段给出通用提示，禁止写实时气温、降水、风力。
2. 不写具体交通班次、车次号、航班号或可购票信息；仅给大致交通方式与动线建议。
3. 景点是否收费、是否需预约，基于常识推断；预约与收费信息必须在【景点预约与收费汇总清单】中单独汇总。
4. 路线按地理顺路安排，避免折返；预算、门票价格为估算区间，须注明「AI 推断，出行前请核实官方信息」。
5. 禁止编造虚假的预约链接、电话或闭馆日期。"""


def build_full_plan_prompt(
    city: str, days: int, extra_request: str = ""
) -> Tuple[str, str]:
    """构建「完整攻略生成」Prompt（9 大输出模块）。"""
    extra_block = ""
    if extra_request.strip():
        extra_block = (
            f"\n- 用户补充描述：{extra_request.strip()}"
            "\n（请在规划中尽量满足上述偏好）"
        )

    user = f"""请为以下需求制定完整旅行攻略：
- 目的地：{city}
- 天数：{days} 天{extra_block}

【重要约束】
1. 不查询任何实时 API；天气建议给出通用提示，禁止写实时气温/降水
2. 不写具体交通班次、不写可购票信息；仅给大致交通方式与动线建议
3. 景点是否收费、是否需预约，必须基于常识推断，并在文末单独汇总，不得只在正文描述
4. 路线按地理顺路安排，避免折返，节奏松紧适中

【输出顺序，必须全部包含】
一、行程概览
二、季节与天气适配建议
三、每日合理路线与攻略（Day1~Day{days}，含上/下午/晚间、顺路美食、当日交通小结；正文景点用「详见汇总清单#N」引用）
四、美食推荐清单（Top 8）
五、景点预约与收费汇总清单（表格：序号|景点|日期|收费|预约|参考费用|备注；覆盖第三节全部景点）
六、交通出行建议（到达方式+市内交通+各日动线）
七、注意事项与必备物品（含「行前预约待办」子清单，列出需预约景点）
八、预算参考（分项区间，注明不含往返大交通）
九、免责声明
十、关联图示（为第五节全部景点 + 第四节 Top8 美食各输出 1 条图示标签，格式：@img[名称|类型|10字内描述]，类型仅限：景点、小吃）

【排版格式要求 — 前端结构化渲染依赖此格式】
1. 章节标题用 Markdown 三级标题，如「### 一、行程概览」
2. 每日行程用四级标题，如「#### Day 1：主题简述」
3. 时段用列表项且加粗时段名，如「- **上午：景点名**（详见汇总清单#1）」，子要点缩进一级列表
4. 美食清单用有序列表，如「1. **小吃名**：描述」
5. 汇总清单必须用 Markdown 表格（| 分隔，含表头分隔行）
6. 关联图示章节只写 @img 标签，每行 1 条，不要其他说明文字

纯文本输出，汇总清单用标准 Markdown 表格。"""
    return SYSTEM_PROMPT, user


def build_revise_prompt(
    current_plan: str, city: str, days: int, feedback: str
) -> Tuple[str, str]:
    """构建「追问最小范围修订」Prompt。"""
    plan_text = current_plan[: config.MAX_PLAN_CONTEXT_CHARS]
    if len(current_plan) > config.MAX_PLAN_CONTEXT_CHARS:
        plan_text += "\n...(上文攻略已截断)"

    user = f"""当前旅行攻略（{city}，{days} 天）：
{plan_text}

用户调整要求：
{feedback}

请做【最小范围】修改，规则如下：
1. 仅改动与用户要求直接相关的部分，未涉及内容尽量保持原文
2. 先输出【调整说明】（3-5 句：改了什么、影响哪些模块）
3. 再输出【修订内容】（只写需更新的章节片段，不要重复未改动章节）
4. 若增删景点或变更预约/收费，同步修订「景点预约与收费汇总清单」相关条目
5. 若变更人数、预算、酒店档次，只修订行程概览、预算参考、注意事项等相关部分
6. 最后输出【{config.UPDATED_PLAN_MARKER}】，整合全部修订后的完整攻略（供后续继续追问使用）
7. 价格与预约仍为 AI 推断，须注明核实官方信息
8. 完整攻略须保留「关联图示」章节，为全部景点与 Top8 美食输出 @img[名称|类型|描述] 标签

示例调整：加人数、不去某景点、美食偏好、更低/更高酒店预算档次等。"""
    return SYSTEM_PROMPT, user


def build_detail_qa_prompt(
    current_plan: str, city: str, days: int, question: str
) -> Tuple[str, str]:
    """构建「细节追问」Prompt：只答用户关心的点，不重出完整攻略。"""
    plan_text = current_plan[: config.MAX_PLAN_CONTEXT_CHARS]
    if len(current_plan) > config.MAX_PLAN_CONTEXT_CHARS:
        plan_text += "\n...(上文攻略已截断)"

    user = f"""用户已完成 {city} {days} 天旅行攻略规划，现针对已有行程追问细节。

【当前完整攻略（仅供上下文，勿整篇复述）】
{plan_text}

【用户问题】
{question}

【作答规则 — 必须遵守】
1. 这是「细节追问」，不是重新规划：禁止输出完整九大模块攻略，禁止「一、行程概览」起头的长篇结构
2. 只回答与用户问题直接相关的内容（问小吃就只讲美食；问交通就只讲交通）
3. 结合 {city} 当地特色与已有攻略上下文，给出 3-8 条具体、可执行建议
4. 可用 Markdown 小标题、有序/无序列表；若需对比信息可用 Markdown 表格（| 分隔）
5. 价格、预约、开放时间均为 AI 推断，须注明「出行前请核实官方信息」
6. 回答篇幅控制在 200-600 字为宜；若用户明确要求「重新规划/完整攻略」才输出长文

直接给出针对性回答，不要前缀「好的，以下是完整攻略」等套话。"""
    return SYSTEM_PROMPT, user


def build_merge_prompt(
    current_plan: str,
    city: str,
    days: int,
    merge_request: str,
    content_to_merge: str,
) -> Tuple[str, str]:
    """构建「合并细节进攻略」Prompt。"""
    plan_text = current_plan[: config.MAX_PLAN_CONTEXT_CHARS]
    if len(current_plan) > config.MAX_PLAN_CONTEXT_CHARS:
        plan_text += "\n...(上文攻略已截断)"

    merge_text = content_to_merge[:4000]
    if len(content_to_merge) > 4000:
        merge_text += "\n...(待合并内容已截断)"

    user = f"""当前旅行攻略（{city}，{days} 天）：
{plan_text}

用户合并要求：
{merge_request}

需要合并进攻略的内容（通常来自上一轮细节回答）：
{merge_text}

【合并规则】
1. 将待合并内容写入攻略对应章节（美食→第四章；景点/预约→第三/五章；交通→第六章等）
2. 保持九大模块结构完整，未涉及章节尽量保持原文
3. 先输出【合并说明】（3-5 句：写入了哪些章节、做了哪些调整）
4. 最后必须输出【{config.UPDATED_PLAN_MARKER}】，给出合并后的完整攻略（供导出与继续追问）
5. 价格与预约仍为 AI 推断，须注明核实官方信息

禁止只输出片段；完整攻略必须放在标记之后。"""
    return SYSTEM_PROMPT, user
