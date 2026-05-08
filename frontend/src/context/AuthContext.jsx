import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMe, logoutApi } from '../utils/api'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const logoutInProgress = useRef(false)

  const isAuthenticated = !!user

  // ── Logout ────────────────────────────────────────────────────────────
  const logout = useCallback(async (opts = {}) => {
    if (logoutInProgress.current) return
    logoutInProgress.current = true

    console.debug('[auth] Logging out...')
    try {
      await logoutApi()
      console.debug('[auth] Backend logout succeeded')
    } catch (err) {
      // Backend might 401 if the token is already expired — that's fine
      console.warn('[auth] Backend logout failed (ignored):', err.response?.status)
    }

    localStorage.removeItem('access_token')
    setUser(null)
    logoutInProgress.current = false

    if (!opts.silent) {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  // ── Login (called after OTP verification) ─────────────────────────────
  const login = useCallback((tokenData) => {
    const { access_token, user: userData } = tokenData
    console.debug('[auth] Login: storing token, user=', userData?.email)
    localStorage.setItem('access_token', access_token)
    setUser(userData)
  }, [])

  // ── Session restore on mount ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const savedToken = localStorage.getItem('access_token')
      if (!savedToken) {
        console.debug('[auth] No saved token — user is unauthenticated')
        setIsLoading(false)
        return
      }

      console.debug('[auth] Found saved token — validating via /auth/me...')
      try {
        const { data } = await fetchMe()
        if (!cancelled) {
          console.debug('[auth] Session restored:', data.email)
          setUser(data)
        }
      } catch (err) {
        console.warn('[auth] Token validation failed:', err.response?.status)
        localStorage.removeItem('access_token')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    restoreSession()
    return () => { cancelled = true }
  }, [])

  // ── Listen for 401 logout events from the axios interceptor ───────────
  useEffect(() => {
    const handleForcedLogout = () => {
      console.warn('[auth] Forced logout via 401 event')
      logout({ silent: false })
    }
    window.addEventListener('auth:logout', handleForcedLogout)
    return () => window.removeEventListener('auth:logout', handleForcedLogout)
  }, [logout])

  const value = { user, isAuthenticated, isLoading, login, logout }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
