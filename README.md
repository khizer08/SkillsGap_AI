# SkillGap AI 
# AI-Powered Career Guidance System
> Upload your resume → Detect skill gaps → Get a personalized roadmap → Practice with mock interviews



##  Setup Instructions

### Prerequisites
- Python 3.11.0
- Node.js 18+
- MongoDB (local or Atlas free tier)

---

# Backend (Windows)

cd skillgap-ai/backend
& "C:\Users\YOUR_USERNAME\AppData\Local\Programs\Python\Python311\python.exe" -m venv venv
& "C:\Users\Syed khizer\AppData\Local\Programs\Python\Python311\python.exe" -m venv venv
.\venv\Scripts\Activate
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl
copy .env.example .env
uvicorn main:app --reload --port 8000

http://127.0.0.1:8000/docs

# Frontend (new terminal)

cd skillgap-ai/frontend
npm install
npm run dev


## MongoDB Setup (Optional)

The app works **without MongoDB** (results won't be persisted, but all features work).

To enable persistence:
```bash
# Option A: Local MongoDB
# Install MongoDB from https://www.mongodb.com/try/download/community
# Then set in .env: MONGO_URI=mongodb://localhost:27017

# Option B: MongoDB Atlas (free cloud)
# Create account at https://cloud.mongodb.com
# Get connection string and set in .env: MONGO_URI=mongodb+srv://...
```

---

## API Endpoints

| Method | Endpoint             | Description                    |
|--------|----------------------|--------------------------------|
| POST   | /api/upload-resume   | Upload PDF, extract skills     |
| GET    | /api/roles           | List available job roles       |
| POST   | /api/analyze         | Run skill gap analysis         |
| POST   | /api/generate-roadmap| Generate AI learning roadmap   |
| POST   | /api/start-interview | Start mock interview session   |
| POST   | /api/submit-answer   | Submit answer + get evaluation |

---

## Quick Test (No PDF needed)

```bash
# Test the analyze endpoint directly with curl:
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-001",
    "resume_skills": ["Python", "React", "Node.js", "MongoDB", "Docker"],
    "job_role": "Full Stack Developer"
  }'
```

---

## System Architecture

```
User Browser (React + TailwindCSS)
        ↓ Axios HTTP
FastAPI Backend (:8000)
        ↓
┌──────────────────────────────────────┐
│  Services Layer                      │
│  ├── ResumeParser (pdfplumber+spaCy) │
│  ├── SkillGapEngine                  │
│  ├── VectorEngine (sentence-trans.)  │
│  ├── RoadmapGenerator (Gemini API)   │
│  └── InterviewEngine                 │
└──────────────────────────────────────┘
        ↓                    ↓
  MongoDB Atlas          ChromaDB
  (persistence)      (vector search)
```

---

## AI Stack

| Component | Technology |
|-----------|-----------|
| PDF Parsing | `pdfplumber` |
| NLP / Skill Extraction | `spaCy en_core_web_sm` |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` |
| Vector DB | `ChromaDB` (local, free) |
| LLM (Roadmap + Interview) | `Gemini 1.5 Flash` (free tier) |
| Mock LLM Fallback | Built-in mock function (no API key needed) |



## Notes

- **No Gemini API key?** The system uses a built-in mock LLM that generates realistic roadmaps and evaluates interviews — all features work offline.
- **No MongoDB?** The system works fully without a database; session data is kept in memory during the session.
- **Model download**: First run downloads `all-MiniLM-L6-v2` (~90MB). This is cached locally after the first download.

Learn Built Upgrade :)

## Deployment (Production)

### 1) Backend (FastAPI)

- Deploy `backend` as a web service (for example, Render/Railway).
- Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

- Set environment variables from `backend/.env.example`.
- Important production values:
  - `CORS_ORIGINS=https://your-frontend-domain.com`
  - `COOKIE_SECURE=true`
  - `COOKIE_SAMESITE=none` (only if frontend and backend are on different domains)

### 2) Frontend (Vite)

- Deploy `frontend` as a static site (for example, Vercel/Netlify).
- Build command:

```bash
npm run build
```

- Publish directory: `dist`
- Set:
  - `VITE_API_BASE_URL=https://your-backend-domain.com/api`

### 3) Local/Dev Defaults still work

- If `VITE_API_BASE_URL` is not set, frontend uses `/api`.
- Dev server proxy still points to `http://localhost:8000` by default.
- Backend keeps local CORS defaults if `CORS_ORIGINS` is not set.