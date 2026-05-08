import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Send, CheckCircle2, XCircle, Trophy, ChevronRight, Loader2, Code2, Users, Terminal } from 'lucide-react'
import { startInterview, submitAnswer } from '../utils/api'

const CATEGORY_ICONS = {
  dsa: Terminal,
  technical: Code2,
  hr: Users,
}
const CATEGORY_LABELS = { dsa: 'DSA', technical: 'Technical', hr: 'HR' }

export default function InterviewPage({ appState }) {
  const navigate = useNavigate()
  const { analysisData } = appState

  const [phase, setPhase]           = useState('select')  // select | active | result
  const [selectedRole, setRole]     = useState(analysisData?.job_role || '')
  const [interviewId, setInterviewId] = useState(null)
  const [questions, setQuestions]   = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answer, setAnswer]         = useState('')
  const [evaluations, setEvals]     = useState([])
  const [finalResult, setFinal]     = useState(null)
  const [loading, setLoading]       = useState(false)
  const [evalFeedback, setFeedback] = useState(null)  // current question feedback
  const textRef = useRef(null)

  const ROLES = ['AI Engineer', 'Data Scientist', 'Full Stack Developer', 'Cybersecurity Analyst']

  useEffect(() => {
    if (textRef.current) textRef.current.focus()
  }, [currentIdx])

  const handleStart = async () => {
    if (!selectedRole) return
    setLoading(true)
    try {
      const { data } = await startInterview({ job_role: selectedRole })
      setInterviewId(data.interview_session_id)
      setQuestions(data.questions)
      setCurrentIdx(0)
      setEvals([])
      setFinal(null)
      setFeedback(null)
      setAnswer('')
      setPhase('active')
    } catch {
      alert('Failed to start interview. Is backend running?')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!answer.trim()) return
    setLoading(true)
    try {
      const q = questions[currentIdx]
      const { data } = await submitAnswer({
        interview_session_id: interviewId,
        question_id: q.id,
        answer: answer.trim()
      })

      const newEval = { ...data.evaluation, question_id: q.id, question: q.question }
      setEvals(prev => [...prev, newEval])
      setFeedback(data.evaluation)

      if (data.interview_complete) {
        setFinal(data.final_result)
        setPhase('result')
      }
    } catch {
      alert('Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    setAnswer('')
    setFeedback(null)
    setCurrentIdx(i => i + 1)
  }

  // ── SELECT PHASE ──────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-primary-500/15 flex items-center justify-center mx-auto mb-6">
          <MessageSquare size={30} className="text-primary-400" />
        </div>
        <h1 className="text-3xl font-extrabold mb-3">Mock Interview</h1>
        <p className="text-white/60 mb-8 text-sm leading-relaxed">
          AI-generated DSA, technical, and HR questions tailored to your target role. Get scored and get feedback.
        </p>

        <div className="card text-left mb-6 space-y-3">
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Select Role</label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all border ${
                  selectedRole === r
                    ? 'bg-primary-500/20 border-primary-500/40 text-primary-300'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!selectedRole || loading}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Generating questions…</> : <><MessageSquare size={16} /> Begin Interview</>}
        </button>
      </main>
    )
  }

  // ── ACTIVE PHASE ──────────────────────────────────────────────────────────
  if (phase === 'active' && questions.length > 0) {
    const q = questions[currentIdx]
    const Icon = CATEGORY_ICONS[q.category] || Code2
    const progress = ((currentIdx) / questions.length) * 100

    return (
      <main className="max-w-3xl mx-auto px-6 py-10 animate-fade-up">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-white/60 mb-2">
            <span>Question {currentIdx + 1} of {questions.length}</span>
            <span>{selectedRole}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="card mb-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1 text-xs text-white/60">
              <Icon size={12} />
              {CATEGORY_LABELS[q.category]}
            </div>
            {q.difficulty && q.difficulty !== 'N/A' && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                q.difficulty === 'Easy' ? 'bg-emerald-500/15 text-emerald-400'
                : q.difficulty === 'Hard' ? 'bg-red-500/15 text-red-400'
                : 'bg-amber-500/15 text-amber-400'
              }`}>{q.difficulty}</span>
            )}
          </div>
          <p className="text-base text-white leading-relaxed">{q.question}</p>
        </div>

        {/* Answer area */}
        {!evalFeedback ? (
          <div className="card space-y-4">
            <textarea
              ref={textRef}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Type your answer here. Be thorough — mention key concepts, examples, and trade-offs..."
              className="input-field resize-none h-36 leading-relaxed"
              disabled={loading}
            />
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!answer.trim() || loading}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {loading ? 'Evaluating…' : 'Submit Answer'}
              </button>
            </div>
          </div>
        ) : (
          /* Feedback card */
          <div className="card space-y-4 border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Feedback</h3>
              <div className={`text-2xl font-extrabold ${
                evalFeedback.score >= 80 ? 'text-emerald-400'
                : evalFeedback.score >= 50 ? 'text-amber-400' : 'text-red-400'
              }`}>{Math.round(evalFeedback.score)}<span className="text-sm text-white/60">/100</span></div>
            </div>

            <p className="text-sm text-white/80 leading-relaxed">{evalFeedback.feedback}</p>

            {evalFeedback.keywords_matched?.length > 0 && (
              <div>
                <p className="text-xs text-white/50 mb-2">Concepts covered</p>
                <div className="flex flex-wrap gap-1.5">
                  {evalFeedback.keywords_matched.map((k, i) => (
                    <span key={i} className="skill-have">{k}</span>
                  ))}
                </div>
              </div>
            )}

            {evalFeedback.improvement_tips?.length > 0 && (
              <div>
                <p className="text-xs text-white/50 mb-2">Tips for improvement</p>
                <ul className="space-y-1">
                  {evalFeedback.improvement_tips.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                      <ChevronRight size={12} className="mt-0.5 text-primary-500 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={handleNext} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {currentIdx < questions.length - 1 ? (<>Next Question <ChevronRight size={16} /></>) : (<>View Results <Trophy size={16} /></>)}
            </button>
          </div>
        )}
      </main>
    )
  }

  // ── RESULT PHASE ──────────────────────────────────────────────────────────
  if (phase === 'result' && finalResult) {
    const score = finalResult.total_score
    const jobReady = finalResult.recommendation === 'job_ready'

    return (
      <main className="max-w-2xl mx-auto px-6 py-16 text-center animate-fade-up">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
          jobReady ? 'bg-emerald-500/15' : 'bg-amber-500/15'
        }`}>
          {jobReady
            ? <Trophy size={36} className="text-emerald-400" />
            : <MessageSquare size={36} className="text-amber-400" />
          }
        </div>

        <h1 className="text-4xl font-extrabold mb-2">
          <span className={jobReady ? 'text-emerald-400' : 'text-amber-400'}>{Math.round(score)}</span>
          <span className="text-white/60 text-2xl">/100</span>
        </h1>
        <p className="text-xl font-semibold mb-3 text-white">{finalResult.message}</p>
        <p className="text-white/60 text-sm mb-8">{questions.length} questions answered</p>

        {/* Per-question scores */}
        <div className="card mb-6 text-left">
          <h3 className="text-sm font-semibold text-white/60 mb-3">Question Breakdown</h3>
          <div className="space-y-2">
            {evaluations.map((e, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-white/50 w-6">Q{i+1}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${e.score >= 80 ? 'bg-emerald-500' : e.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${e.score}%` }}
                  />
                </div>
                <span className={`text-xs font-mono w-8 text-right ${
                  e.score >= 80 ? 'text-emerald-400' : e.score >= 50 ? 'text-amber-400' : 'text-red-400'
                }`}>{Math.round(e.score)}</span>
              </div>
            ))}
          </div>
        </div>

        {finalResult.improvement_areas?.length > 0 && (
          <div className="card mb-6 text-left">
            <h3 className="text-sm font-semibold text-white/60 mb-3">Areas to Improve</h3>
            <ul className="space-y-1.5">
              {finalResult.improvement_areas.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                  <ChevronRight size={14} className="text-primary-500 mt-0.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => setPhase('select')} className="btn-ghost flex-1">Retry Interview</button>
          <button onClick={() => navigate('/dashboard')} className="btn-primary flex-1">Dashboard</button>
        </div>
      </main>
    )
  }

  return null
}
