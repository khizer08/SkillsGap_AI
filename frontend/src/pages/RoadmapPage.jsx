import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Code2, ExternalLink, ChevronDown, ChevronRight, Layers, Star, MessageSquare, Loader2, AlertCircle } from 'lucide-react'

const toArray = (value) => Array.isArray(value) ? value : []

const safeResource = (value) => {
  const text = String(value || '').trim()
  if (!text) return null

  const href = /^https?:\/\//i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(href)
    return {
      href: url.href,
      label: url.hostname.replace('www.', '') || text,
    }
  } catch {
    return {
      href: `https://www.google.com/search?q=${encodeURIComponent(text)}`,
      label: text,
    }
  }
}

export default function RoadmapPage({ appState, updateState }) {
  const navigate = useNavigate()
  const { roadmapData, analysisData, roadmapStatus, roadmapError } = appState
  const [openWeek, setOpenWeek] = useState(0)

  if (roadmapStatus === 'generating') {
    return (
      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="card py-12">
          <Loader2 size={28} className="animate-spin text-primary-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Generating your roadmap</h1>
          <p className="text-white/70">
            Gemini is building a personalized week-by-week plan. Keep this page open.
          </p>
        </div>
      </main>
    )
  }

  if (roadmapStatus === 'error') {
    return (
      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="card py-12">
          <AlertCircle size={28} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Roadmap generation failed</h1>
          <p className="text-white/70 mb-6">{roadmapError || 'Please try generating the roadmap again.'}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">Back to Dashboard</button>
        </div>
      </main>
    )
  }

  if (!roadmapData) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="text-white/70 mb-4">No roadmap generated yet.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">Back to Dashboard</button>
      </div>
    )
  }

  const weeks = toArray(roadmapData?.weeks)
  const project_suggestions = toArray(roadmapData?.project_suggestions)
  const course_recommendations = toArray(roadmapData?.course_recommendations)
  const missing_skills = toArray(roadmapData?.missing_skills)
  const job_role = roadmapData?.job_role || analysisData?.job_role || 'Selected Role'

  if (!weeks.length) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="card py-12">
          <AlertCircle size={28} className="text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Roadmap data is incomplete</h1>
          <p className="text-white/70 mb-6">The backend responded, but no weekly plan was available.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">Generate Again</button>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10 animate-fade-up">
        <p className="text-sm text-white/50 mb-1">Personalized Roadmap</p>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">{job_role} Learning Path</h1>
        <p className="text-white/60 text-sm">
          {weeks.length}-week plan to master: {missing_skills.slice(0, 5).join(', ')}{missing_skills.length > 5 ? ` +${missing_skills.length - 5} more` : ''}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Weekly plan */}
        <div className="lg:col-span-2 space-y-3 animate-fade-up-2">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Weekly Schedule</h2>
          {weeks.map((week, i) => {
            const tasks = toArray(week?.tasks)
            const resources = toArray(week?.resources).map(safeResource).filter(Boolean)

            return (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpenWeek(openWeek === i ? -1 : i)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center text-xs font-bold text-primary-400 shrink-0">
                    W{week?.week || i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{week?.topic || `Week ${i + 1}`}</p>
                    <p className="text-xs text-white/50">{tasks.length} tasks</p>
                  </div>
                </div>
                {openWeek === i
                  ? <ChevronDown size={16} className="text-white/50 shrink-0" />
                  : <ChevronRight size={16} className="text-white/50 shrink-0" />
                }
              </button>

              {openWeek === i && (
                <div className="mt-4 space-y-4 border-t border-white/8 pt-4">
                  {/* Tasks */}
                  <div>
                    <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2">Tasks</p>
                    <ul className="space-y-1.5">
                      {tasks.map((task, ti) => (
                        <li key={ti} className="flex items-start gap-2 text-sm text-white/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                          {task}
                        </li>
                      ))}
                      {tasks.length === 0 && (
                        <li className="text-sm text-white/50">No tasks listed for this week.</li>
                      )}
                    </ul>
                  </div>

                  {/* Resources */}
                  {resources.length > 0 && (
                    <div>
                      <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2">Resources</p>
                      <div className="flex flex-wrap gap-2">
                        {resources.map((resource, ri) => (
                          <a
                            key={ri}
                            href={resource.href}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 bg-primary-500/8 px-2.5 py-1 rounded-lg border border-primary-500/15 transition-colors"
                          >
                            <ExternalLink size={10} />
                            {resource.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Project */}
                  {week.project && (
                    <div className="bg-primary-500/8 border border-primary-500/15 rounded-xl px-4 py-3">
                      <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Code2 size={10} /> Weekly Project
                      </p>
                      <p className="text-sm text-white/80">{week.project}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            )
          })}
        </div>

        {/* Sidebar */}
        <div className="space-y-6 animate-fade-up-3">
          {/* Projects */}
          <div>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers size={13} /> Project Ideas
            </h2>
            <div className="space-y-3">
              {project_suggestions.map((p, i) => (
                <div key={i} className="card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-white">{p?.title || 'Project idea'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      p?.difficulty === 'Beginner' ? 'bg-emerald-500/15 text-emerald-400'
                      : p?.difficulty === 'Intermediate' ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-red-500/15 text-red-400'
                    }`}>{p?.difficulty || 'Advanced'}</span>
                  </div>
                  <p className="text-xs text-white/60 mb-2">{p?.description || 'Practice the roadmap skills in a focused portfolio project.'}</p>
                  <div className="flex flex-wrap gap-1">
                    {toArray(p?.skills_covered).map((s, si) => (
                      <span key={si} className="skill-badge bg-white/5 text-white/70 border border-white/8">{s}</span>
                    ))}
                  </div>
                  <p className="text-xs text-white/50 mt-2">Time: {p?.estimated_time || 'Self-paced'}</p>
                </div>
              ))}
              {project_suggestions.length === 0 && (
                <div className="card text-sm text-white/50">No project ideas returned yet.</div>
              )}
            </div>
          </div>

          {/* Courses */}
          <div>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BookOpen size={13} /> Study Materials
            </h2>
            <div className="space-y-3">
              {course_recommendations.map((c, i) => {
                const resource = safeResource(c?.url || c?.link || c?.platform || c?.title)
                return (
                <a key={i} href={resource?.href || '#'} target="_blank" rel="noreferrer"
                  className="card block hover:border-primary-500/30 transition-colors group">
                  <div className="flex items-start gap-2 mb-1">
                    <Star size={12} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium text-white group-hover:text-white/90 transition-colors">{c?.title || 'Recommended resource'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span>{c?.platform || 'Online'}</span>
                    <span>·</span>
                    <span>{c?.duration || 'Self-paced'}</span>
                    <span>·</span>
                    <span className="text-emerald-400">{c?.price || 'Free/Paid'}</span>
                  </div>
                </a>
                )
              })}
              {course_recommendations.length === 0 && (
                <div className="card text-sm text-white/50">No study materials returned yet.</div>
              )}
            </div>
          </div>

          {/* Interview CTA */}
          <button
            onClick={() => navigate('/interview')}
            className="w-full btn-primary flex items-center justify-center gap-2 py-3"
          >
            <MessageSquare size={16} />
            Start Mock Interview
          </button>
        </div>
      </div>
    </main>
  )
}
