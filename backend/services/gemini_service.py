"""
Reusable Gemini generation service for SkillGap AI.
Produces schema-shaped JSON for roadmaps and interview questions.
"""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from pydantic import ValidationError

from models.schemas import InterviewQuestion, RoadmapWeek

load_dotenv()
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


async def call_gemini(prompt: str, *, max_output_tokens: int = 4096) -> str:
    """Call Gemini and return the model text response."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
        },
    }

    logger.info("Gemini request started: model=%s, prompt_chars=%s", GEMINI_MODEL, len(prompt))
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            headers={"Content-Type": "application/json"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    text = data["candidates"][0]["content"]["parts"][0]["text"]
    logger.info("Gemini response received: chars=%s", len(text))
    logger.debug("Gemini response preview: %s", text[:500])
    return text


def _parse_json_response(raw_response: str) -> Any:
    """Parse Gemini JSON, tolerating occasional markdown wrappers."""
    clean = re.sub(r"```json\s*|\s*```", "", raw_response).strip()
    return json.loads(clean)


def _fallback_roadmap(
    job_role: str,
    missing_skills: List[str],
    extracted_resume_skills: List[str],
) -> Dict[str, Any]:
    skills = missing_skills[:12] or ["Core fundamentals"]
    num_weeks = min(max(len(skills), 4), 12)
    weeks = []

    for index in range(num_weeks):
        skill = skills[index % len(skills)]
        weeks.append({
            "week": index + 1,
            "topic": f"{skill} for {job_role}",
            "tasks": [
                f"Review the fundamentals of {skill}",
                f"Complete two hands-on exercises using {skill}",
                f"Apply {skill} in a small portfolio feature",
                "Document learnings and interview notes",
            ],
            "resources": [
                f"https://www.youtube.com/results?search_query={skill.replace(' ', '+')}+tutorial",
                f"https://www.coursera.org/search?query={skill.replace(' ', '+')}",
                f"https://www.freecodecamp.org/news/search/?query={skill.replace(' ', '%20')}",
            ],
            "project": f"Build a {job_role} mini-project focused on {skill}",
        })

    return {
        "job_role": job_role,
        "missing_skills": missing_skills,
        "weeks": weeks,
        "total_duration_weeks": len(weeks),
        "project_suggestions": [
            {
                "title": f"{job_role} Skill Builder",
                "description": "A focused project that turns the highest-priority gaps into working features.",
                "skills_covered": skills[:3],
                "difficulty": "Beginner",
                "estimated_time": "1-2 weeks",
            },
            {
                "title": f"{job_role} Portfolio Capstone",
                "description": "A practical end-to-end project combining resume strengths with missing skills.",
                "skills_covered": list(dict.fromkeys(extracted_resume_skills[:3] + skills[:4])),
                "difficulty": "Intermediate",
                "estimated_time": "3-4 weeks",
            },
        ],
        "course_recommendations": [
            {
                "title": f"{job_role} complete learning path",
                "platform": "Coursera",
                "url": f"https://www.coursera.org/search?query={job_role.replace(' ', '+')}",
                "duration": "6-12 weeks",
                "price": "Free to audit",
            },
            {
                "title": f"{job_role} video tutorials",
                "platform": "YouTube",
                "url": f"https://www.youtube.com/results?search_query={job_role.replace(' ', '+')}", 
                "duration": "Self-paced",
                "price": "Free",
            },
            {
                "title": f"{job_role} hands-on courses",
                "platform": "Udemy",
                "url": f"https://www.udemy.com/courses/search/?q={job_role.replace(' ', '+')}",
                "duration": "10-40 hours",
                "price": "$10-50",
            },
            {
                "title": f"Learn {job_role} fundamentals",
                "platform": "freeCodeCamp",
                "url": f"https://www.freecodecamp.org/news/search/?query={job_role.replace(' ', '+')}",
                "duration": "Self-paced",
                "price": "Free",
            },
            {
                "title": f"{job_role} professional certification",
                "platform": "LinkedIn Learning",
                "url": f"https://www.linkedin.com/learning/search?keywords={job_role.replace(' ', '+')}",
                "duration": "4-8 weeks",
                "price": "Free trial",
            },
            {
                "title": f"{job_role} on edX",
                "platform": "edX",
                "url": f"https://www.edx.org/search?q={job_role.replace(' ', '+')}",
                "duration": "8-12 weeks",
                "price": "Free or paid",
            },
        ],
    }


def _fallback_interview_questions(
    job_role: str,
    skills: List[str],
    difficulty: str,
) -> List[Dict[str, Any]]:
    focus_skills = list(dict.fromkeys(skills + [
        "problem solving",
        "system design",
        "debugging",
        "communication",
        "testing",
        "deployment",
    ]))[:6]
    questions = []

    for index, skill in enumerate(focus_skills[:6], start=1):
        questions.append({
            "id": f"technical_{index}",
            "question": f"How would you apply {skill} in a real {job_role} project?",
            "category": "technical",
            "difficulty": difficulty,
            "expected_keywords": [skill, "trade-offs", "implementation"],
        })

    questions.extend([
        {
            "id": "dsa_1",
            "question": f"Describe an efficient algorithm or data structure you would use in a {job_role} workflow.",
            "category": "dsa",
            "difficulty": difficulty,
            "expected_keywords": ["complexity", "data structure", "optimization"],
        },
        {
            "id": "hr_1",
            "question": f"Tell me about a project that prepared you for a {job_role} position.",
            "category": "hr",
            "difficulty": "N/A",
            "expected_keywords": ["project", "impact", "learning"],
        },
        {
            "id": "hr_2",
            "question": "Describe how you handle feedback when improving a technical solution.",
            "category": "hr",
            "difficulty": "N/A",
            "expected_keywords": ["feedback", "iteration", "collaboration"],
        },
    ])
    return questions[:9]


async def generate_roadmap(
    job_role: str,
    missing_skills: List[str],
    extracted_resume_skills: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Generate a RoadmapResult-shaped payload, without session_id."""
    extracted_resume_skills = extracted_resume_skills or []
    num_weeks = min(max(len(missing_skills), 4), 12)

    prompt = f"""
Return only valid JSON for a personalized learning roadmap.

Inputs:
- job_role: {job_role}
- missing_skills: {json.dumps(missing_skills)}
- extracted_resume_skills: {json.dumps(extracted_resume_skills)}
- duration_weeks: {num_weeks}

The JSON object must contain exactly these top-level fields:
job_role, missing_skills, weeks, total_duration_weeks, project_suggestions, course_recommendations.

Rules:
- job_role must equal the input job_role.
- missing_skills must equal the input missing_skills.
- total_duration_weeks must equal the number of week objects.
- weeks must contain exactly {num_weeks} objects.
- Each week object must contain: week, topic, tasks, resources, project.
- tasks must be an array of practical actions.
- resources must be an array of working URLs to documentation, tutorials, or learning materials.
- Each resource should be a complete HTTPS URL that actually exists and is accessible.
- project_suggestions and course_recommendations must be arrays of objects.

For course_recommendations:
- Each object must have: title, platform, url, duration, price
- url must be a working HTTPS link to that platform (e.g., Coursera, Udemy, YouTube, freeCodeCamp, LinkedIn Learning, edX)
- Include 5-6 diverse course recommendations from different platforms
- For search-based platforms, generate URLs with query parameters for the job_role
""".strip()

    try:
        raw_response = await call_gemini(prompt)
        parsed = _parse_json_response(raw_response)
        weeks = [RoadmapWeek(**week).model_dump() for week in parsed.get("weeks", [])]
        result = {
            "job_role": parsed.get("job_role", job_role),
            "missing_skills": parsed.get("missing_skills", missing_skills),
            "weeks": weeks,
            "total_duration_weeks": len(weeks),
            "project_suggestions": parsed.get("project_suggestions", []),
            "course_recommendations": parsed.get("course_recommendations", []),
        }
        if len(result["weeks"]) != num_weeks:
            raise ValueError(f"Gemini returned {len(result['weeks'])} roadmap weeks, expected {num_weeks}")
        logger.info("Gemini roadmap validated: role=%s, weeks=%s", job_role, len(weeks))
        return result
    except (RuntimeError, httpx.HTTPError, KeyError, TypeError, ValueError, ValidationError, json.JSONDecodeError) as e:
        logger.warning("Gemini roadmap generation failed, using fallback: %s", e)
        return _fallback_roadmap(job_role, missing_skills, extracted_resume_skills)


async def generate_interview_questions(
    job_role: str,
    skills: Optional[List[str]] = None,
    difficulty: str = "Medium",
) -> List[Dict[str, Any]]:
    """Generate InterviewQuestion-shaped dicts."""
    skills = skills or []
    prompt = f"""
Return only valid JSON for interview questions.

Inputs:
- job_role: {job_role}
- skills: {json.dumps(skills)}
- difficulty: {difficulty}

Return a JSON array of exactly 9 objects.
Each object must match this schema exactly:
{{
  "id": "unique string",
  "question": "question text",
  "category": "dsa | technical | hr",
  "difficulty": "{difficulty} or N/A",
  "expected_keywords": ["keyword1", "keyword2", "keyword3"]
}}

Include a balanced mix of DSA, technical, and HR questions.
Make questions specific to the job role and skills.
""".strip()

    try:
        raw_response = await call_gemini(prompt)
        parsed = _parse_json_response(raw_response)
        if not isinstance(parsed, list):
            raise ValueError("Gemini interview response must be a JSON array")

        questions = []
        for index, item in enumerate(parsed[:9], start=1):
            question = InterviewQuestion(
                id=str(item.get("id") or f"gemini_{index}"),
                question=item["question"],
                category=item.get("category", "technical"),
                difficulty=item.get("difficulty", difficulty),
                expected_keywords=item.get("expected_keywords", []),
            )
            questions.append(question.model_dump())

        if len(questions) != 9:
            raise ValueError(f"Gemini returned {len(questions)} interview questions, expected 9")
        logger.info("Gemini interview questions validated: role=%s, count=%s", job_role, len(questions))
        return questions
    except (RuntimeError, httpx.HTTPError, KeyError, TypeError, ValueError, ValidationError, json.JSONDecodeError) as e:
        logger.warning("Gemini interview generation failed, using fallback: %s", e)
        return _fallback_interview_questions(job_role, skills, difficulty)
