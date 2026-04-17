from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


PackageStatus = Literal["draft", "confirmed"]


class SourceMaterialInput(BaseModel):
    kind: Literal["image", "text", "card"] = "text"
    title: str
    content: str


class MicroLessonDraftRequest(BaseModel):
    title: str = Field(..., min_length=1)
    theme: str = Field(..., min_length=1)
    age_band: str = Field(default="6岁")
    class_profile: str = Field(default="粤语和英语环境中的普通话初学者")
    source_materials: list[SourceMaterialInput] = Field(min_length=1)


class TimeBlock(BaseModel):
    id: str
    minutes: str
    title: str
    teacher_goal: str
    display_prompt: str
    teacher_moves: list[str]
    child_task: str


class ScaffoldPath(BaseModel):
    id: str
    name: str
    learner_signal: str
    support_tools: list[str]
    response_goal: str
    teacher_move: str
    sample_prompt: str


class ObservationSignal(BaseModel):
    id: str
    label: str
    summary: str


class TeacherPromptCard(BaseModel):
    block_id: str
    objective: str
    optional_prompts: list[str]
    support_pivot: str


class StudentCard(BaseModel):
    id: str
    alias: str
    current_support: str
    recent_performance: str
    sticky_points: list[str]
    next_move: str


class ReflectionSummary(BaseModel):
    teacher_headline: str
    class_snapshot: list[str]
    effective_scaffolds: list[str]
    blocked_points: list[str]
    next_lesson_moves: list[str]


class MicroLessonPackage(BaseModel):
    id: str
    status: PackageStatus
    title: str
    theme: str
    age_band: str
    class_profile: str
    source_materials: list[SourceMaterialInput]
    hook: str
    core_question: str
    language_goals: list[str]
    focus_support: list[str]
    time_blocks: list[TimeBlock]
    scaffold_paths: list[ScaffoldPath]
    observation_signals: list[ObservationSignal]
    teacher_prompt_cards: list[TeacherPromptCard]
    student_cards: list[StudentCard]
    reflection_summary: ReflectionSummary | None = None
    next_lesson_moves: list[str] = Field(default_factory=list)


class ConfirmMicroLessonRequest(BaseModel):
    hook: str | None = None
    core_question: str | None = None


class ClassroomSignalRequest(BaseModel):
    block_id: str
    signal_id: str
    student_ids: list[str] = Field(default_factory=list)


class ClassroomRecommendation(BaseModel):
    block_id: str
    signal_id: str
    recommended_path: str
    teacher_move: str
    display_prompt: str
    optional_prompts: list[str]
    selected_students: list[str]


class StudentSignalUpdate(BaseModel):
    student_id: str
    signal_id: str


class ReflectionRequest(BaseModel):
    teacher_note: str | None = None
    signal_ids: list[str] = Field(default_factory=list)
    student_updates: list[StudentSignalUpdate] = Field(default_factory=list)


def _dedupe(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        item = value.strip()
        if item and item not in seen:
            seen.add(item)
            output.append(item)
    return output


_PREFERRED_SPOTLIGHT_WORDS = [
    "粽子",
    "龙舟",
    "端午",
    "叶子",
    "米",
    "月饼",
    "汤圆",
    "中秋",
    "家人",
    "节日",
    "过节",
    "食物",
]

_GENERIC_WORDS = {
    "老师",
    "图片",
    "图案",
    "时候",
    "我们",
    "有些",
    "家庭",
    "一起",
    "里面",
    "不同",
    "大家",
    "特别",
}


def _extract_words(
    title: str, theme: str, source_materials: list[SourceMaterialInput]
) -> list[str]:
    joined = " ".join([title, theme, *[material.content for material in source_materials]])
    preferred = [word for word in _PREFERRED_SPOTLIGHT_WORDS if word in joined]

    direct_matches = [
        token
        for token in re.findall(r"[\u4e00-\u9fff]{2,4}", joined)
        if token not in _GENERIC_WORDS
    ]

    return _dedupe([*preferred, *direct_matches])[:6]


def _lesson_designer(payload: MicroLessonDraftRequest) -> MicroLessonPackage:
    words = _extract_words(payload.title, payload.theme, payload.source_materials)
    spotlight = words[:3] if words else ["月饼", "汤圆", "家人"]
    hook = (
        f"盒子里藏着一种只有特别日子才会出现的食物。"
        f"你觉得它会是 {spotlight[0]}、{spotlight[1]}，还是别的东西？"
    )
    core_question = "为什么有些食物会在特别的日子吃？"
    focus_support = [
        f"目标词：{'、'.join(spotlight)}",
        "句框：这是…… / 我在……的时候吃……",
        "微技能：先稳住命名，再尝试说一点原因",
    ]
    time_blocks = [
        TimeBlock(
            id="block-hook",
            minutes="0-2 分钟",
            title="神秘食盒",
            teacher_goal="用图片和悬念收集孩子已有词汇。",
            display_prompt="你觉得盒子里藏着什么特别食物？",
            teacher_moves=["先猜一猜", "让孩子指图或说一个词", "记录谁需要图片支持"],
            child_task="看图、猜测、指认",
        ),
        TimeBlock(
            id="block-guided-talk",
            minutes="2-5 分钟",
            title="什么时候会吃",
            teacher_goal="让孩子把食物和节日 / 家庭场景连起来。",
            display_prompt="什么时候会吃这种食物？谁会一起吃？",
            teacher_moves=["追问场景", "改成二选一", "给句框支持"],
            child_task="选图、补句、说场景",
        ),
        TimeBlock(
            id="block-small-group",
            minutes="5-8 分钟",
            title="小组轻互动",
            teacher_goal="用同题不同支架推进到简单原因表达。",
            display_prompt="你觉得它为什么特别？",
            teacher_moves=["先问谁会吃", "再问为什么特别", "必要时把问题缩成‘因为……’"],
            child_task="用图片或句框表达一点原因",
        ),
        TimeBlock(
            id="block-close",
            minutes="8-10 分钟",
            title="收束与记录",
            teacher_goal="把本课发现说出来，并完成极轻量观察。",
            display_prompt="今天我们发现了什么？下次还想知道什么？",
            teacher_moves=["表扬表达", "点选支架信号", "准备课后反馈"],
            child_task="跟老师一起复盘",
        ),
    ]
    scaffold_paths = [
        ScaffoldPath(
            id="path-support",
            name="图片支持路",
            learner_signal="适合需要图片提示或先命名的孩子。",
            support_tools=["图片卡", "二选一", "动作示范"],
            response_goal="孩子能指出并说出一个关键词。",
            teacher_move="先让孩子选图，再把词说出来。",
            sample_prompt="这是月饼还是苹果？",
        ),
        ScaffoldPath(
            id="path-sentence",
            name="句框短句路",
            learner_signal="适合已经能命名，但还需要句框的孩子。",
            support_tools=["句框", "场景卡", "同伴跟读"],
            response_goal="孩子能说出‘我在……吃……’。",
            teacher_move="先让孩子补全半句，再邀请完整重复。",
            sample_prompt="我在____的时候吃月饼。",
        ),
        ScaffoldPath(
            id="path-reason",
            name="原因表达路",
            learner_signal="适合能说短句、愿意尝试‘因为’的孩子。",
            support_tools=["原因提示卡", "比较问题", "教师追问"],
            response_goal="孩子能说出一句简单原因。",
            teacher_move="保留核心问题，但把回答负担缩到一句。",
            sample_prompt="因为会和家人一起吃，所以它很特别。",
        ),
    ]
    observation_signals = [
        ObservationSignal(
            id="needs_visual_support",
            label="需要图片支持",
            summary="孩子需要图片、动作或二选一才能进入任务。",
        ),
        ObservationSignal(
            id="can_name_keyword",
            label="能说出关键词",
            summary="孩子已经能稳定命名目标食物或节日词。",
        ),
        ObservationSignal(
            id="can_build_sentence",
            label="能说短句",
            summary="孩子能在句框支持下说出场景或对象。",
        ),
        ObservationSignal(
            id="can_offer_reason",
            label="能说一点原因",
            summary="孩子开始尝试‘因为……’或给出简单理由。",
        ),
        ObservationSignal(
            id="stuck_or_silent",
            label="不回应 / 卡住",
            summary="孩子暂时不回应，或反复停在同一步骤。",
        ),
    ]
    teacher_prompt_cards = [
        TeacherPromptCard(
            block_id="block-hook",
            objective="先让孩子把注意力聚焦到‘特别食物’上。",
            optional_prompts=["你觉得这是什么？", "你见过它吗？", "你在哪里看过它？"],
            support_pivot="如果没回应，立刻改成图片二选一。",
        ),
        TeacherPromptCard(
            block_id="block-guided-talk",
            objective="把食物和场景、人物连起来。",
            optional_prompts=["什么时候会吃？", "谁会一起吃？", "你会和家人一起吃吗？"],
            support_pivot="如果句子出不来，就给‘我在……吃……’句框。",
        ),
        TeacherPromptCard(
            block_id="block-small-group",
            objective="试探孩子是否能从命名走到简单原因表达。",
            optional_prompts=["为什么它是特别的？", "你觉得它和家人有什么关系？", "可以用‘因为……’说吗？"],
            support_pivot="如果原因说不出，就退回‘谁会一起吃’。",
        ),
        TeacherPromptCard(
            block_id="block-close",
            objective="让老师收口并把观察转成课后反馈。",
            optional_prompts=["今天我们发现了什么？", "下次还想知道什么？"],
            support_pivot="如果孩子疲劳，就只做一个关键词复盘。",
        ),
    ]
    student_cards = [
        StudentCard(
            id="student-moon",
            alias="小月亮",
            current_support="图片支持路",
            recent_performance="看到图片后能说出‘月饼’，但还需要场景提示。",
            sticky_points=["需要图片支持", "节日词和日常食物容易混淆"],
            next_move="下次继续保留图片卡，并先问‘谁会一起吃’。",
        ),
        StudentCard(
            id="student-lantern",
            alias="小灯笼",
            current_support="原因表达路",
            recent_performance="已经能用‘因为会和家人一起吃’说出简单原因。",
            sticky_points=["原因句还能更完整"],
            next_move="下次保留原因句框，再多问一个‘为什么特别’。",
        ),
        StudentCard(
            id="student-ricecake",
            alias="小年糕",
            current_support="句框短句路",
            recent_performance="能说‘我在过节的时候吃月饼’，但偶尔需要教师跟读。",
            sticky_points=["短句稳定，原因表达还在起步"],
            next_move="下次继续用句框，慢慢加入‘因为’开头。",
        ),
    ]
    return MicroLessonPackage(
        id=f"lesson-{uuid4().hex[:8]}",
        status="draft",
        title=payload.title,
        theme=payload.theme,
        age_band=payload.age_band,
        class_profile=payload.class_profile,
        source_materials=payload.source_materials,
        hook=hook,
        core_question=core_question,
        language_goals=[
            "能认出并说出两种特别食物。",
            "能说出什么时候会吃，以及会和谁一起吃。",
            "在支架下尝试用‘因为……’说一点原因。",
        ],
        focus_support=focus_support,
        time_blocks=time_blocks,
        scaffold_paths=scaffold_paths,
        observation_signals=observation_signals,
        teacher_prompt_cards=teacher_prompt_cards,
        student_cards=student_cards,
        next_lesson_moves=[
            "保留同一个探究问题，但在下一节课加一张家庭场景图。",
            "把原因表达继续缩成一句‘因为……’。",
        ],
    )


_SIGNAL_TO_PATH = {
    "needs_visual_support": "path-support",
    "stuck_or_silent": "path-support",
    "can_name_keyword": "path-support",
    "can_build_sentence": "path-sentence",
    "can_offer_reason": "path-reason",
}

_SIGNAL_TO_MOVE = {
    "needs_visual_support": (
        "先停在图片支持路，让孩子先选图，再邀请说一个关键词。"
    ),
    "can_name_keyword": "顺着孩子已经说出的词，往‘什么时候会吃’推进一步。",
    "can_build_sentence": "继续使用句框，但开始去掉一个提示词，让孩子补出短句。",
    "can_offer_reason": "保持同一个问题，改成一句原因表达，不要再加新信息。",
    "stuck_or_silent": "暂时不追原因，先退回最稳的二选一和指图动作。",
}

_SIGNAL_TO_PROMPTS = {
    "needs_visual_support": ["这是月饼还是汤圆？", "你指一指哪一个会在特别的时候吃。"] ,
    "can_name_keyword": ["什么时候会吃它？", "谁会一起吃？", "你能再说一次这个食物吗？"],
    "can_build_sentence": ["我在____的时候吃月饼。", "我和____一起吃。"],
    "can_offer_reason": ["它为什么特别？", "可以用‘因为……’来说一点点吗？"],
    "stuck_or_silent": ["先选一张图告诉我。", "你觉得是过节的时候，还是每天都吃？"],
}

_SIGNAL_TO_STUDENT_CARD = {
    "needs_visual_support": (
        "图片支持路",
        "在图片和二选一帮助下进入了任务。",
        "需要图片支持",
        "下次继续保留图片卡，再慢慢补短句。",
    ),
    "can_name_keyword": (
        "图片支持路",
        "已经能稳定说出关键词。",
        "开始从命名走向短句",
        "下次加入一句‘我在……吃……’。",
    ),
    "can_build_sentence": (
        "句框短句路",
        "已经能借句框说出场景短句。",
        "原因表达还在起步",
        "下次保留句框，增加一个‘因为’提示。",
    ),
    "can_offer_reason": (
        "原因表达路",
        "已经能说出简单原因。",
        "原因句还可以更完整",
        "下次保留原因句框，再追一个补充信息。",
    ),
    "stuck_or_silent": (
        "图片支持路",
        "课堂中有卡住或暂时不回应的情况。",
        "需要更低负担的进入方式",
        "下次先从选图和动作开始，不急着追问。",
    ),
}


def route_signal(
    package: MicroLessonPackage,
    payload: ClassroomSignalRequest,
) -> ClassroomRecommendation:
    block = next((item for item in package.time_blocks if item.id == payload.block_id), None)
    if block is None:
        msg = f"Unknown block id: {payload.block_id}"
        raise ValueError(msg)

    path_id = _SIGNAL_TO_PATH.get(payload.signal_id, "path-support")
    path = next(item for item in package.scaffold_paths if item.id == path_id)
    prompts = _SIGNAL_TO_PROMPTS.get(payload.signal_id, [path.sample_prompt])

    return ClassroomRecommendation(
        block_id=payload.block_id,
        signal_id=payload.signal_id,
        recommended_path=path.name,
        teacher_move=_SIGNAL_TO_MOVE.get(payload.signal_id, path.teacher_move),
        display_prompt=block.display_prompt,
        optional_prompts=prompts,
        selected_students=payload.student_ids,
    )


def synthesize_reflection(
    package: MicroLessonPackage,
    payload: ReflectionRequest,
) -> MicroLessonPackage:
    signal_labels = {
        signal.id: signal.label for signal in package.observation_signals
    }
    updated_students = []
    update_lookup = {item.student_id: item.signal_id for item in payload.student_updates}
    effective_scaffolds: list[str] = []
    blocked_points: list[str] = []

    for card in package.student_cards:
        signal_id = update_lookup.get(card.id)
        if not signal_id:
            updated_students.append(card)
            continue
        support, performance, sticky_point, next_move = _SIGNAL_TO_STUDENT_CARD[signal_id]
        sticky_points = _dedupe([*card.sticky_points, sticky_point])
        updated_students.append(
            card.model_copy(
                update={
                    "current_support": support,
                    "recent_performance": performance,
                    "sticky_points": sticky_points,
                    "next_move": next_move,
                }
            )
        )
        if signal_id in {"can_build_sentence", "can_offer_reason"}:
            effective_scaffolds.append(support)
        if signal_id in {"needs_visual_support", "stuck_or_silent"}:
            blocked_points.append(signal_labels.get(signal_id, signal_id))

    summary = ReflectionSummary(
        teacher_headline="这节课更像是一节成功的启蒙探究微课：全班围绕同一个问题进入，但支架层次需要继续精细区分。",
        class_snapshot=[
            "大多数孩子能进入‘特别食物’这个主题。",
            "图片支持仍然是最稳的入口。",
            "已经有个别孩子可以尝试原因表达。",
        ],
        effective_scaffolds=_dedupe(effective_scaffolds) or ["句框短句路"],
        blocked_points=_dedupe(blocked_points) or ["原因表达启动仍然偏难"],
        next_lesson_moves=[
            "保留同样的 hook 结构，但把‘为什么特别’拆得更小。",
            "继续使用家庭场景卡，让孩子先说‘和谁一起吃’。",
            "对已能说原因的孩子，再追问一次‘为什么会一起吃’。",
        ],
    )
    teacher_note = payload.teacher_note.strip() if payload.teacher_note else ""
    headline = summary.teacher_headline
    if teacher_note:
        headline = f"{headline} 教师备注：{teacher_note}"

    return package.model_copy(
        update={
            "student_cards": updated_students,
            "reflection_summary": summary.model_copy(
                update={"teacher_headline": headline}
            ),
            "next_lesson_moves": summary.next_lesson_moves,
        }
    )
