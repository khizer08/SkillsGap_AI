"""
Mock Interview Engine Service
- Generates DSA, technical, and HR questions based on job role
- Evaluates answers using LLM
- Scores responses 0-100
"""

import json
import logging
import re
from typing import List, Dict, Optional
from services.gemini_service import call_gemini
from services.gemini_service import generate_interview_questions as generate_gemini_interview_questions

logger = logging.getLogger(__name__)

async def generate_interview_questions(
    job_role: str,
    skills: Optional[List[str]] = None,
    difficulty: str = "Medium",
) -> List[Dict]:
    """
    Generate interview questions for a given role using Gemini.
    Keeps the existing route/service function name intact.
    """
    return await generate_gemini_interview_questions(
        job_role=job_role,
        skills=skills or [],
        difficulty=difficulty,
    )


async def evaluate_answer(
    question: str,
    answer: str,
    expected_keywords: List[str],
    category: str
) -> Dict:
    """
    Evaluate a user's answer using LLM.
    Returns score (0-100), feedback, and improvement tips.
    """
    if not answer or len(answer.strip()) < 10:
        return {
            "score": 0,
            "feedback": "No answer provided.",
            "keywords_matched": [],
            "improvement_tips": ["Please provide a detailed answer.", "Try to explain your thought process."]
        }

    # Quick keyword check (always done regardless of LLM)
    answer_lower = answer.lower()
    matched_keywords = [kw for kw in expected_keywords if kw.lower() in answer_lower]
    keyword_score = (len(matched_keywords) / max(len(expected_keywords), 1)) * 40

    prompt = f"""You are an expert technical interviewer evaluating a candidate's answer.

Question: {question}
Category: {category}
Candidate's Answer: {answer}
Expected Keywords/Concepts: {', '.join(expected_keywords)}

Evaluate the answer and return ONLY valid JSON (no markdown):
{{
  "score": <integer 0-100>,
  "feedback": "<2-3 sentences of specific feedback>",
  "improvement_tips": ["<specific tip 1>", "<specific tip 2>", "<specific tip 3>"]
}}

Scoring guide:
- 90-100: Excellent, covers all key concepts with depth
- 70-89: Good, covers most concepts
- 50-69: Partial, missing some important concepts
- 30-49: Basic understanding but lacks depth
- 0-29: Incorrect or very incomplete"""

    try:
        response = await call_gemini(prompt)
        clean = re.sub(r'```json\s*|\s*```', '', response).strip()
        eval_data = json.loads(clean)
        
        # Blend LLM score with keyword score
        llm_score = float(eval_data.get("score", 50))
        final_score = round((llm_score * 0.7) + (keyword_score * 0.3), 1)
        
        return {
            "score": min(100, final_score),
            "feedback": eval_data.get("feedback", "Good attempt."),
            "keywords_matched": matched_keywords,
            "improvement_tips": eval_data.get("improvement_tips", [])
        }

    except Exception as e:
        logger.warning(f"LLM evaluation failed: {e}, using keyword-based scoring")
        # Fallback: pure keyword scoring
        fallback_score = min(100, keyword_score * 2.5)
        return {
            "score": round(fallback_score, 1),
            "feedback": f"You mentioned {len(matched_keywords)}/{len(expected_keywords)} key concepts.",
            "keywords_matched": matched_keywords,
            "improvement_tips": [
                f"Make sure to cover: {', '.join(set(expected_keywords) - set(matched_keywords))}" if expected_keywords else "Elaborate more on your answer.",
                "Structure your answer clearly with examples.",
                "Demonstrate practical experience where possible."
            ]
        }


def calculate_final_score(evaluations: List[Dict]) -> Dict:
    """
    Calculate final interview score from all evaluations.
    Returns overall score and recommendation.
    """
    if not evaluations:
        return {"total_score": 0, "recommendation": "incomplete", "areas_to_improve": []}

    scores = [e.get("score", 0) for e in evaluations]
    avg_score = round(sum(scores) / len(scores), 1)

    # Categorize by performance
    if avg_score >= 85:
        recommendation = "job_ready"
        message = "Congratulations! You are ready for the job market."
    elif avg_score >= 70:
        recommendation = "almost_ready"
        message = "Good performance! A bit more practice and you'll be ready."
    elif avg_score >= 50:
        recommendation = "needs_practice"
        message = "Keep practicing. Focus on the areas highlighted below."
    else:
        recommendation = "needs_improvement"
        message = "You need significant improvement. Review the fundamentals."

    # Collect improvement areas
    all_tips = []
    for e in evaluations:
        all_tips.extend(e.get("improvement_tips", []))

    return {
        "total_score": avg_score,
        "recommendation": recommendation,
        "message": message,
        "breakdown": {
            "total_questions": len(evaluations),
            "avg_score": avg_score,
            "scores": scores
        },
        "improvement_areas": list(set(all_tips))[:5]  # Top 5 unique tips
    }
