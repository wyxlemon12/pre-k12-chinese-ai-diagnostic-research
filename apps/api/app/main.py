from collections.abc import Iterable
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.settings import settings


class ParseLessonRequest(BaseModel):
    title: str = Field(..., description="Teacher-facing lesson title.")
    text: str = Field(..., min_length=1, description="Lesson text or excerpt.")
    theme: str | None = Field(default=None, description="Optional lesson theme.")


class ObservationOption(BaseModel):
    id: str
    label: str
    dimension: str
    look_for: str


class WorksheetItem(BaseModel):
    id: str
    prompt: str
    dimension: str
    error_pattern: str
    recovery_move: str


class LessonParseResponse(BaseModel):
    title: str
    theme: str
    lesson_summary: str
    target_words: list[str]
    target_sentences: list[str]
    comprehension_goals: list[str]
    observation_options: list[ObservationOption]
    worksheet_items: list[WorksheetItem]
    evidence_sources: list[str]


class LessonPathwaysRequest(BaseModel):
    title: str
    theme: str
    target_words: list[str]
    target_sentences: list[str]
    comprehension_goals: list[str]


class PathwayCard(BaseModel):
    id: str
    name: str
    learner_profile: str
    scaffolds: list[str]
    micro_activity: str
    success_signal: str


class LessonPathwaysResponse(BaseModel):
    title: str
    theme: str
    pathway_cards: list[PathwayCard]


WorksheetOutcome = Literal["secure", "partial", "stuck"]


class WorksheetResult(BaseModel):
    item_id: str
    outcome: WorksheetOutcome


class DiagnoseRequest(BaseModel):
    title: str
    theme: str
    selected_observation_ids: list[str] = Field(default_factory=list)
    worksheet_results: list[WorksheetResult] = Field(default_factory=list)
    teacher_note: str | None = None


class EvidenceChainItem(BaseModel):
    evidence: str
    inference: str
    next_move: str


class DiagnoseResponse(BaseModel):
    focus_dimension: str
    teacher_summary: str
    group_signal: str
    evidence_chain: list[EvidenceChainItem]
    next_steps: list[str]


DIMENSION_COPY: dict[str, dict[str, str]] = {
    "听懂程度": {
        "signal": "孩子能跟上课堂语流，但需要更稳定的提示来完成回应。",
        "next_move": "下一轮先保留图片和动作支架，再把口头问题缩成两选一。",
    },
    "认字与词汇": {
        "signal": "当前卡点更像是核心词汇和目标字不够稳，影响后续理解。",
        "next_move": "先重教 4-6 个高频词和关键词，再回到原文做短句定位。",
    },
    "朗读与口语输出": {
        "signal": "学生理解有基础，但在朗读或说出完整句子时需要句框支持。",
        "next_move": "下次保留回声朗读和句框补全，降低一次性输出负担。",
    },
    "阅读理解": {
        "signal": "学生能看到表层信息，但原因解释和证据回指还不够稳定。",
        "next_move": "下一轮追问聚焦“为什么”和“你从哪里看出来”，强化证据表达。",
    },
}

OBSERVATION_LIBRARY: list[ObservationOption] = [
    ObservationOption(
        id="listening_visual_support",
        label="需要图片提示",
        dimension="听懂程度",
        look_for="教师口头说明后，学生需要看图或动作示范才开始进入任务。",
    ),
    ObservationOption(
        id="listening_silent",
        label="听懂但不回应",
        dimension="听懂程度",
        look_for="能跟上活动，但口头回应延迟或只做非语言反应。",
    ),
    ObservationOption(
        id="vocabulary_unstable",
        label="核心词汇不稳",
        dimension="认字与词汇",
        look_for="读到目标词时犹豫，或在选图、连线中混淆词义。",
    ),
    ObservationOption(
        id="character_hesitation",
        label="认字犹豫",
        dimension="认字与词汇",
        look_for="看到目标字时停顿明显，需要教师带读或同伴提示。",
    ),
    ObservationOption(
        id="oral_framing",
        label="朗读不顺",
        dimension="朗读与口语输出",
        look_for="能跟读但句子不完整，声调或停连影响整体表达。",
    ),
    ObservationOption(
        id="reasoning_support",
        label="只会找事实",
        dimension="阅读理解",
        look_for="能指出人物或地点，但难以解释原因、情绪或线索。",
    ),
    ObservationOption(
        id="reasoning_emerging",
        label="能解释原因",
        dimension="阅读理解",
        look_for="能用文本或图片证据解释人物选择或情绪变化。",
    ),
]


def _dedupe(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            output.append(value)
    return output


def _extract_candidate_words(text: str) -> list[str]:
    chunks = text.replace("\n", " ").replace("，", " ").replace("、", " ").split(" ")
    cleaned = [chunk.strip(" 。！？；：,.!?;:\"'()[]{}") for chunk in chunks]
    words = [chunk for chunk in cleaned if 1 < len(chunk) <= 6]
    if words:
        return _dedupe(words)[:10]

    chars = [char for char in text if "\u4e00" <= char <= "\u9fff"]
    return _dedupe(chars)[:10]


def _extract_candidate_sentences(text: str) -> list[str]:
    normalized = text.replace("\n", "").replace("！", "。").replace("？", "。")
    sentences = [part.strip() for part in normalized.split("。") if part.strip()]
    return [f"{sentence}。" for sentence in sentences[:2]]


def _build_lesson_summary(title: str, theme: str, target_words: list[str]) -> str:
    spotlight = "、".join(target_words[:4]) if target_words else "人物、地点、动作"
    return f"{title} 适合围绕「{theme}」做一次 15-25 分钟的微活动课，重点聚焦 {spotlight}。"


def _build_comprehension_goals(target_words: list[str], title: str) -> list[str]:
    anchor_word = target_words[0] if target_words else title
    return [
        "找出人物、地点与关键动作",
        f"围绕「{anchor_word}」完成一次选图或连线回应",
        "在教师追问下完成一次低门槛原因解释",
    ]


def _build_worksheet_items(target_words: list[str]) -> list[WorksheetItem]:
    first_word = target_words[0] if target_words else "课文词语"
    second_word = target_words[1] if len(target_words) > 1 else "人物信息"
    return [
        WorksheetItem(
            id="worksheet_fact_match",
            prompt=f"把「{first_word}」和对应图片连起来。",
            dimension="认字与词汇",
            error_pattern="词义和字形绑定不稳，容易被相似图像干扰。",
            recovery_move="下次先做图词配对，再进入整段阅读。",
        ),
        WorksheetItem(
            id="worksheet_sentence_frame",
            prompt=f"用句框补全一句和「{second_word}」相关的话。",
            dimension="朗读与口语输出",
            error_pattern="知道答案但难以完整说出句子，需要句框支架。",
            recovery_move="保留句框和回声朗读，先让学生完成半开放表达。",
        ),
        WorksheetItem(
            id="worksheet_reasoning",
            prompt="看图回答“为什么会这样”。",
            dimension="阅读理解",
            error_pattern="能找事实，但还不能稳定回到证据做解释。",
            recovery_move="改成两步追问：先找线索，再说原因。",
        ),
    ]


def _build_pathway_cards(payload: LessonPathwaysRequest) -> list[PathwayCard]:
    target_word = payload.target_words[0] if payload.target_words else payload.theme
    target_sentence = payload.target_sentences[0] if payload.target_sentences else "我会用一个完整句子回应。"
    goal = payload.comprehension_goals[-1] if payload.comprehension_goals else "完成一次低门槛原因解释"
    return [
        PathwayCard(
            id="pathway_support",
            name="故事探索卡",
            learner_profile="适合刚进入文本、需要图片和动作支架的孩子。",
            scaffolds=["图片先行", "两选一回应", "同伴带读", "教师示范句框"],
            micro_activity=f"先指认和「{target_word}」相关的图片，再完成一次二选一口头回应。",
            success_signal="孩子能跟上节奏，并完成至少一次选图或点选表达。",
        ),
        PathwayCard(
            id="pathway_core",
            name="词语侦探卡",
            learner_profile="适合能进入原文、需要稳定词汇和句子理解的孩子。",
            scaffolds=["目标词提示条", "关键句停顿标记", "工作纸映射"],
            micro_activity=f"围绕句子「{target_sentence}」找关键词，并完成一次事实提取。",
            success_signal="孩子能读出或指出关键句，并完成对应工作纸题目。",
        ),
        PathwayCard(
            id="pathway_extend",
            name="分享小达人卡",
            learner_profile="适合理解较快，已经能连接个人经验或做简单推论的孩子。",
            scaffolds=["原因句框", "比较提示", "开放式追问"],
            micro_activity=f"围绕目标「{goal}」做一次原因解释或个人经验连接。",
            success_signal="孩子能说出“因为……”或给出一句和文本相关的扩展表达。",
        ),
    ]


def _score_dimensions(
    selected_observation_ids: list[str], worksheet_results: list[WorksheetResult]
) -> dict[str, int]:
    scores = {dimension: 0 for dimension in DIMENSION_COPY}
    observation_lookup = {option.id: option for option in OBSERVATION_LIBRARY}

    for observation_id in selected_observation_ids:
        option = observation_lookup.get(observation_id)
        if option:
            scores[option.dimension] += 2

    worksheet_dimension_lookup = {
        "worksheet_fact_match": "认字与词汇",
        "worksheet_sentence_frame": "朗读与口语输出",
        "worksheet_reasoning": "阅读理解",
    }
    outcome_weights: dict[WorksheetOutcome, int] = {
        "secure": 0,
        "partial": 1,
        "stuck": 2,
    }

    for worksheet in worksheet_results:
        dimension = worksheet_dimension_lookup.get(worksheet.item_id)
        if dimension:
            scores[dimension] += outcome_weights[worksheet.outcome]

    return scores


def _build_evidence_chain(
    focus_dimension: str,
    selected_observation_ids: list[str],
    worksheet_results: list[WorksheetResult],
    teacher_note: str | None,
) -> list[EvidenceChainItem]:
    observation_lookup = {option.id: option for option in OBSERVATION_LIBRARY}
    worksheet_lookup = {
        "worksheet_fact_match": "工作纸事实提取题",
        "worksheet_sentence_frame": "句框补全任务",
        "worksheet_reasoning": "原因解释题",
    }
    evidence_chain: list[EvidenceChainItem] = []

    for observation_id in selected_observation_ids:
        option = observation_lookup.get(observation_id)
        if option and option.dimension == focus_dimension:
            evidence_chain.append(
                EvidenceChainItem(
                    evidence=f"课堂观察点：{option.label}",
                    inference=f"该表现提示学生在「{focus_dimension}」维度需要更多支架。",
                    next_move=DIMENSION_COPY[focus_dimension]["next_move"],
                )
            )

    for worksheet in worksheet_results:
        if worksheet.outcome == "secure":
            continue
        worksheet_dimension = {
            "worksheet_fact_match": "认字与词汇",
            "worksheet_sentence_frame": "朗读与口语输出",
            "worksheet_reasoning": "阅读理解",
        }.get(worksheet.item_id)
        if worksheet_dimension == focus_dimension:
            label = worksheet_lookup.get(worksheet.item_id, worksheet.item_id)
            evidence_chain.append(
                EvidenceChainItem(
                    evidence=f"{label} 结果为 {worksheet.outcome}",
                    inference=f"该题型进一步暴露了「{focus_dimension}」的薄弱点。",
                    next_move=DIMENSION_COPY[focus_dimension]["next_move"],
                )
            )

    if teacher_note and teacher_note.strip():
        evidence_chain.append(
            EvidenceChainItem(
                evidence=f"教师备注：{teacher_note.strip()}",
                inference="教师的一线观察补充了课堂中的真实语境与情绪线索。",
                next_move="保留这条备注，下一次对照同类任务观察是否仍然出现。",
            )
        )

    if not evidence_chain:
        evidence_chain.append(
            EvidenceChainItem(
                evidence="当前没有明显的薄弱证据聚集。",
                inference="这节课更适合作为基线课次，用来区分哪些支架已经足够。",
                next_move="下一次增加一题轻量原因解释或一次口头复述，继续拉开层次。",
            )
        )

    return evidence_chain[:3]


app = FastAPI(
    title="Pre-K12 Chinese Diagnostic Harness API",
    version="0.2.0",
    summary="Harness service for lesson parsing and recommendation workflows.",
)

ALLOWED_ORIGINS = {
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def allow_private_network_preflight(request: Request, call_next):
    origin = request.headers.get("origin")
    private_network = request.headers.get("access-control-request-private-network")

    if (
        request.method == "OPTIONS"
        and private_network == "true"
        and origin in ALLOWED_ORIGINS
    ):
        requested_headers = request.headers.get("access-control-request-headers", "*")
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT",
                "Access-Control-Allow-Headers": requested_headers,
                "Access-Control-Allow-Private-Network": "true",
                "Access-Control-Max-Age": "600",
                "Vary": "Origin",
            },
        )

    return await call_next(request)


@app.get("/")
def read_root() -> dict[str, object]:
    return {
        "project": "pre-k12-chinese-ai-diagnostic-research",
        "environment": settings.environment,
        "docs": "/docs",
        "health": "/healthz",
    }


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


@app.post("/api/v1/lessons/parse", response_model=LessonParseResponse)
def parse_lesson(payload: ParseLessonRequest) -> LessonParseResponse:
    title = payload.title.strip()
    theme = (payload.theme or title).strip()
    target_words = _extract_candidate_words(payload.text)
    target_sentences = _extract_candidate_sentences(payload.text)
    comprehension_goals = _build_comprehension_goals(target_words, title)

    return LessonParseResponse(
        title=title,
        theme=theme,
        lesson_summary=_build_lesson_summary(title, theme, target_words),
        target_words=target_words,
        target_sentences=target_sentences or [payload.text[:24].strip()],
        comprehension_goals=comprehension_goals,
        observation_options=OBSERVATION_LIBRARY[:6],
        worksheet_items=_build_worksheet_items(target_words),
        evidence_sources=[
            "提问梯度卡：观察性问题",
            "工作纸映射：事实提取与句框补全",
            "课堂观察点：按小组记录高信息量表现",
        ],
    )


@app.post("/api/v1/lessons/pathways", response_model=LessonPathwaysResponse)
def build_pathways(payload: LessonPathwaysRequest) -> LessonPathwaysResponse:
    return LessonPathwaysResponse(
        title=payload.title,
        theme=payload.theme,
        pathway_cards=_build_pathway_cards(payload),
    )


@app.post("/api/v1/observations/diagnose", response_model=DiagnoseResponse)
def diagnose_observations(payload: DiagnoseRequest) -> DiagnoseResponse:
    scores = _score_dimensions(
        payload.selected_observation_ids,
        payload.worksheet_results,
    )
    focus_dimension = max(scores, key=scores.get)
    strongest_signal = scores[focus_dimension]
    teacher_summary = (
        f"{payload.title} 这节课里，当前最值得优先跟进的是「{focus_dimension}」。"
        f"{DIMENSION_COPY[focus_dimension]['signal']}"
    )
    group_signal = (
        "建议先按小组补一次短支架，再决定是否需要全班重教。"
        if strongest_signal >= 3
        else "目前更像局部卡点，可先对个别学生或小组做补救。"
    )
    evidence_chain = _build_evidence_chain(
        focus_dimension,
        payload.selected_observation_ids,
        payload.worksheet_results,
        payload.teacher_note,
    )

    next_steps = [
        DIMENSION_COPY[focus_dimension]["next_move"],
        "把下节课的第一轮任务控制在 3 分钟内，先确认孩子能进入文本。",
        "课后保留一条教师备注，帮助比较同类文本下的迁移情况。",
    ]

    return DiagnoseResponse(
        focus_dimension=focus_dimension,
        teacher_summary=teacher_summary,
        group_signal=group_signal,
        evidence_chain=evidence_chain,
        next_steps=next_steps,
    )
