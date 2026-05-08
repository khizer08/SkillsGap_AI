import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, ChevronDown, Sparkles, AlertCircle, Loader2 } from 'lucide-react'
import { uploadResume, analyzeSkills, getRoles } from '../utils/api'

export default function UploadPage({ appState, updateState }) {
  const navigate = useNavigate()
  const [file, setFile]           = useState(null)
  const [roles, setRoles]         = useState([])
  const [selectedRole, setRole]   = useState('')
  const [jdText, setJdText]       = useState('')
  const [error, setError]         = useState('')
  const [step, setStep]           = useState('idle') // idle | uploading | analyzing | done

  useEffect(() => {
    getRoles().then(r => setRoles(r.data.roles)).catch(() => {})
  }, [])

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) { setFile(accepted[0]); setError('') }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024
  })

  const handleSubmit = async () => {
    setError('')
    if (!file) return setError('Please upload your resume (PDF).')
    if (!selectedRole && !jdText.trim()) return setError('Select a job role or paste a job description.')

    try {
      // Step 1: Upload resume
      setStep('uploading')
      const { data: resumeData } = await uploadResume(file)
      updateState({
        sessionId: resumeData.session_id,
        resumeData,
        roadmapData: null,
        roadmapStatus: 'idle',
        roadmapError: '',
      })

      // Step 2: Analyze skill gap
      setStep('analyzing')
      const payload = {
        session_id: resumeData.session_id,
        resume_skills: [
          ...resumeData.skills,
          ...resumeData.technologies,
          ...resumeData.frameworks
        ],
        ...(selectedRole && { job_role: selectedRole }),
        ...(jdText.trim() && { jd_text: jdText.trim() })
      }
      const { data: analysisData } = await analyzeSkills(payload)
      updateState({
        analysisData,
        selectedRole: selectedRole || 'Custom JD',
        roadmapData: null,
        roadmapStatus: 'idle',
        roadmapError: '',
      })

      setStep('done')
      navigate('/dashboard')
    } catch (e) {
      setStep('idle')
      setError(e.response?.data?.detail || 'Something went wrong. Is the backend running?')
    }
  }

  const loading = step === 'uploading' || step === 'analyzing'

  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-14 animate-fade-up">
        <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-4 py-1.5 text-xs text-primary-400 font-medium mb-6">
          <Sparkles size={12} /> AI-Powered Career Intelligence
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight mb-4">
          Find Your <span className="text-primary-500">Skill Gap</span>,<br />
          Build Your Career
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          Upload your resume and target role. We'll analyze your gaps, generate a learning roadmap, and prep you for interviews.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 animate-fade-up-2">
        {/* Resume Upload */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <FileText size={16} className="text-primary-400" />
            Resume <span className="text-red-400">*</span>
          </h2>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-primary-500 bg-primary-500/10'
                : file
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                  <FileText size={20} className="text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-emerald-400 truncate px-4">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB • Click to replace</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                  <Upload size={20} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-400">
                  {isDragActive ? 'Drop it here!' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-slate-600">PDF only · Max 10MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Job Target */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles size={16} className="text-primary-400" />
            Target Role <span className="text-red-400">*</span>
          </h2>

          {/* Role dropdown */}
          <div className="relative">
            <select
              value={selectedRole}
              onChange={e => { setRole(e.target.value); setJdText('') }}
              className="input-field appearance-none pr-10 !text-black !bg-white"
            >
              <option value="">— Select a job role —</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <div className="flex-1 h-px bg-white/10" />
            <span>or paste JD</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* JD Text */}
          <textarea
            value={jdText}
            onChange={e => { setJdText(e.target.value); setRole('') }}
            placeholder="Paste the Job Description here..."
            className="input-field resize-none h-28 text-xs leading-relaxed"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* CTA */}
      <div className="mt-8 flex justify-center animate-fade-up-3">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary flex items-center gap-2.5 text-base px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {step === 'uploading' ? 'Parsing resume…' : 'Analyzing skills…'}
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Analyze My Skills
            </>
          )}
        </button>
      </div>

      {/* Feature pills */}
      <div className="mt-14 flex flex-wrap justify-center gap-3 text-xs text-slate-500 animate-fade-up-3">
        {['spaCy NLP Extraction', 'Vector Similarity Engine', 'Gemini AI Roadmap', 'Mock Interview System'].map(f => (
          <span key={f} className="bg-white/5 border border-white/8 rounded-full px-3 py-1">{f}</span>
        ))}
      </div>
    </main>
  )
}
