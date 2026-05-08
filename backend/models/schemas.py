"""
Pydantic models (schemas) for SkillGap AI
Used for request/response validation and MongoDB documents
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class SkillStatus(str, Enum):
    HAVE = "have"
    PARTIAL = "partial"
    MISSING = "missing"


class SkillResult(BaseModel):
    skill: str
    status: SkillStatus
    match_score: Optional[float] = None
    matched_with: Optional[str] = None


class ResumeAnalysis(BaseModel):
    session_id: str
    extracted_skills: List[str]
    technologies: List[str]
    frameworks: List[str]
    projects: List[str]
    raw_text_preview: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SkillGapResult(BaseModel):
    session_id: str
    job_role: str
    match_percentage: float
    have_skills: List[SkillResult]
    partial_skills: List[SkillResult]
    missing_skills: List[SkillResult]
    recommendation: str  # "interview" or "roadmap"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RoadmapWeek(BaseModel):
    week: int
    topic: str
    tasks: List[str]
    resources: List[str]
    project: Optional[str] = None


class RoadmapResult(BaseModel):
    session_id: str
    job_role: str
    missing_skills: List[str]
    weeks: List[RoadmapWeek]
    total_duration_weeks: int
    project_suggestions: List[Dict[str, Any]]
    course_recommendations: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class InterviewQuestion(BaseModel):
    id: str
    question: str
    category: str  # "dsa", "technical", "hr"
    difficulty: Optional[str] = None
    expected_keywords: Optional[List[str]] = None


class InterviewSession(BaseModel):
    session_id: str
    job_role: str
    questions: List[InterviewQuestion]
    current_question_index: int = 0
    answers: List[Dict[str, Any]] = []
    total_score: Optional[float] = None
    status: str = "active"  # active, completed
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AnswerSubmission(BaseModel):
    session_id: str
    question_id: str
    answer: str


class AnswerEvaluation(BaseModel):
    question_id: str
    score: float  # 0-100
    feedback: str
    keywords_matched: List[str]
    improvement_tips: List[str]
