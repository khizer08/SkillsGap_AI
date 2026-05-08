import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Brain, Mail, ShieldCheck, Loader2, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { requestOtp, resendOtp, verifyOtp } from '../utils/api'
import { useAuth } from '../context/AuthContext'

const OTP_LENGTH = 6
const OTP_COUNTDOWN_SECONDS = 120 // 2 minutes = OTP expiry

export default function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // ── State ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState('email')         // 'email' | 'otp'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Resend
  const [countdown, setCountdown] = useState(0)
  const [resendCount, setResendCount] = useState(0)
  const timerRef = useRef(null)

  // OTP input refs
  const inputRefs = useRef([])

  // ── Countdown timer ──────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setCountdown(OTP_COUNTDOWN_SECONDS)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // ── Format countdown mm:ss ────────────────────────────────────────────
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── Step 1: Request OTP ──────────────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return setError('Please enter a valid email address.')
    }

    setLoading(true)
    try {
      console.debug('[auth:login] Requesting OTP for', trimmed)
      await requestOtp(trimmed)
      setEmail(trimmed)
      setStep('otp')
      setOtp(Array(OTP_LENGTH).fill(''))
      setResendCount(0)
      startCountdown()
      setSuccess('A 6-digit code has been sent to your email.')
      console.debug('[auth:login] OTP sent successfully')
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || ''
      if (status === 429) {
        setError('Too many OTP requests. Please try again later.')
      } else if (status === 502) {
        setError('Could not send email. Please try again in a moment.')
      } else {
        setError(detail || 'Failed to send OTP. Is the backend running?')
      }
      console.error('[auth:login] OTP request failed:', status, detail)
    } finally {
      setLoading(false)
    }
  }

  // ── OTP input handling ───────────────────────────────────────────────
  const focusInput = (index) => {
    inputRefs.current[index]?.focus()
  }

  const handleOtpChange = (index, value) => {
    // Allow only digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    setError('')

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      focusInput(index + 1)
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      focusInput(index - 1)
    }
    if (e.key === 'ArrowLeft' && index > 0) focusInput(index - 1)
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) focusInput(index + 1)
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length > 0) {
      const newOtp = Array(OTP_LENGTH).fill('')
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i]
      }
      setOtp(newOtp)
      focusInput(Math.min(pasted.length, OTP_LENGTH - 1))
    }
  }

  // ── Step 2: Verify OTP ───────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const otpString = otp.join('')
    if (otpString.length !== OTP_LENGTH) {
      return setError('Please enter the complete 6-digit code.')
    }

    setLoading(true)
    try {
      console.debug('[auth:login] Verifying OTP for', email)
      const { data } = await verifyOtp(email, otpString)
      console.debug('[auth:login] OTP verified, JWT received')
      login(data)
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || ''
      if (detail.toLowerCase().includes('expired')) {
        setError('OTP has expired. Please request a new one.')
      } else if (detail.toLowerCase().includes('invalid')) {
        setError('Invalid OTP. Please check and try again.')
      } else {
        setError(detail || 'Verification failed. Please try again.')
      }
      console.error('[auth:login] OTP verification failed:', status, detail)
    } finally {
      setLoading(false)
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────
  const handleResend = async () => {
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      console.debug('[auth:login] Resending OTP for', email)
      await resendOtp(email)
      setResendCount(prev => prev + 1)
      setOtp(Array(OTP_LENGTH).fill(''))
      startCountdown()
      setSuccess('A new code has been sent to your email.')
      focusInput(0)
      console.debug('[auth:login] OTP resent successfully')
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || ''
      if (status === 429) {
        setError('Resend limit reached. Please try again in a few minutes.')
      } else {
        setError(detail || 'Failed to resend OTP.')
      }
      console.error('[auth:login] OTP resend failed:', status, detail)
    } finally {
      setLoading(false)
    }
  }

  // ── Go back to email step ────────────────────────────────────────────
  const handleBack = () => {
    setStep('email')
    setOtp(Array(OTP_LENGTH).fill(''))
    setError('')
    setSuccess('')
    setCountdown(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  // ── Auth guards (after all hooks) ────────────────────────────────────
  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-primary-500 animate-spin" />
      </main>
    )
  }

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Brain size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              SkillGap <span className="text-primary-500">AI</span>
            </span>
          </div>
          <p className="text-white/70 text-sm">
            {step === 'email'
              ? 'Sign in to access your career intelligence dashboard'
              : `Enter the code sent to ${email}`}
          </p>
        </div>

        {/* Card */}
        <div className="card">
          {/* ───── Email Step ───── */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-white mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    placeholder="you@example.com"
                    autoFocus
                    autoComplete="email"
                    className="input-field pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending code…
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Send Login Code
                  </>
                )}
              </button>
            </form>
          )}

          {/* ───── OTP Step ───── */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              {/* Back button */}
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white/80 transition-colors"
              >
                <ArrowLeft size={14} /> Change email
              </button>

              {/* OTP Inputs */}
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  <ShieldCheck size={14} className="inline mr-1.5 -mt-0.5" />
                  Verification Code
                </label>
                <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (inputRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                      disabled={loading}
                      className="otp-input"
                      aria-label={`Digit ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Countdown */}
              {countdown > 0 && (
                <div className="text-center">
                  <span className="text-xs text-white/60">
                    Code expires in{' '}
                    <span className={`font-mono font-semibold ${countdown <= 30 ? 'text-red-400 animate-pulse' : 'text-primary-400'}`}>
                      {formatTime(countdown)}
                    </span>
                  </span>
                </div>
              )}
              {countdown === 0 && step === 'otp' && (
                <div className="text-center">
                  <span className="text-xs text-amber-400">Code may have expired</span>
                </div>
              )}

              {/* Verify button */}
              <button
                type="submit"
                disabled={loading || otp.join('').length !== OTP_LENGTH}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Verify & Sign In
                  </>
                )}
              </button>

              {/* Resend */}
              <div className="text-center pt-1">
                {countdown > 0 ? (
                  <p className="text-xs text-white/60">
                    Resend available in {formatTime(countdown)}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading || resendCount >= 3}
                    className="inline-flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors disabled:text-white/40 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={12} />
                    {resendCount >= 3
                      ? 'Resend limit reached'
                      : `Resend Code (${3 - resendCount} left)`}
                  </button>
                )}
              </div>
            </form>
          )}

          {/* ───── Feedback messages ───── */}
          {error && (
            <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {success && !error && (
            <div className="mt-4 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/60 mt-8">
          We'll send a one-time code to your email. No password needed.
        </p>
      </div>
    </main>
  )
}
