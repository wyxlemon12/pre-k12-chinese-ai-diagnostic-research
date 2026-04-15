from collections.abc import Iterable

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.settings import settings


class ParseLessonRequest(BaseModel):
    title: str = Field(..., description="Teacher-facing lesson title.")
    text: str = Field(..., min_length=1, description="Lesson text or excerpt.")
    theme: str | None = Field(default=None, description="Optional lesson theme.")


class LessonParseResponse(BaseModel):
    title: str
    theme: str
    target_words: list[str]
    target_sentences: list[str]
    comprehension_goals: list[str]
    evidence_points: list[str]


def _dedupe(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            output.append(value)
    return output


def _extract_candidate_words(text: str) -> list[str]:
    cleaned = [
        chunk.strip(" ，。！？；：、,.!?;:\"'()[]{}")
        for chunk in text.replace("\n", " ").split(" ")
    ]
    words = [chunk for chunk in cleaned if 1 < len(chunk) <= 6]
    if words:
        return _dedupe(words)[:10]
    chars = [char for char in text if "\u4e00" <= char <= "\u9fff"]
    return _dedupe(chars)[:10]


def _extract_candidate_sentences(text: str) -> list[str]:
    sentences = [part.strip() for part in text.replace("\n", "").split("。") if part.strip()]
    return [f"{sentence}。" for sentence in sentences[:2]]


app = FastAPI(
    title="Pre-K12 Chinese Diagnostic Harness API",
    version="0.1.0",
    summary="Harness service for lesson parsing and recommendation workflows.",
)


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
    target_words = _extract_candidate_words(payload.text)
    target_sentences = _extract_candidate_sentences(payload.text)
    title = payload.title.strip()
    theme = (payload.theme or title).strip()

    comprehension_goals = [
        "找出人物与地点",
        "识别关键喜好或动作",
        "完成一次低门槛原因解释",
    ]
    evidence_points = [
        "提问梯度卡：观察性问题",
        "工作纸映射：事实提取题",
        "课堂观察点：听懂但不回应 / 需要图片提示",
    ]

    return LessonParseResponse(
        title=title,
        theme=theme,
        target_words=target_words,
        target_sentences=target_sentences or [payload.text[:20]],
        comprehension_goals=comprehension_goals,
        evidence_points=evidence_points,
    )
