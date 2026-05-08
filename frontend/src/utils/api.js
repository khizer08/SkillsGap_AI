import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // Gemini calls can take longer than regular API calls
  withCredentials: true, // send httpOnly access_token cookie on every request
})

// ── Request interceptor: attach Bearer token + debug log ─────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  console.debug('[api:start]', config.method?.toUpperCase(), config.url, config.data || '')
  return config
})

// ── Response interceptor: debug log + global 401 handler ─────────────────
api.interceptors.response.use(
  (response) => {
    console.debug('[api:end]', response.config.method?.toUpperCase(), response.config.url, response.status, response.data)
    return response
  },
  (error) => {
    console.error(
      '[api:error]',
      error.config?.method?.toUpperCase(),
      error.config?.url,
      error.response?.status,
      error.response?.data || error.message
    )
    // If any authenticated request returns 401, fire a global logout event
    // so AuthContext can clear state. Skip for the auth endpoints themselves.
    const url = error.config?.url || ''
    const isAuthEndpoint = url.includes('/auth/request-otp') ||
                           url.includes('/auth/resend-otp') ||
                           url.includes('/auth/verify-otp')
    if (error.response?.status === 401 && !isAuthEndpoint) {
      console.warn('[auth] 401 detected — dispatching global logout')
      window.dispatchEvent(new Event('auth:logout'))
    }
    return Promise.reject(error)
  }
)

// ── Resume ────────────────────────────────────────────────────────────────
export const uploadResume = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload-resume', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// ── Roles ─────────────────────────────────────────────────────────────────
export const getRoles = () => api.get('/roles')

// ── Analysis ─────────────────────────────────────────────────────────────
export const analyzeSkills = (payload) => api.post('/analyze', payload)

// ── Roadmap ───────────────────────────────────────────────────────────────
export const generateRoadmap = (payload) => api.post('/generate-roadmap', payload, {
  timeout: 180000,
})

// ── Interview ─────────────────────────────────────────────────────────────
export const startInterview = (payload) => api.post('/start-interview', payload)
export const submitAnswer   = (payload) => api.post('/submit-answer', payload)

// ── Auth ──────────────────────────────────────────────────────────────────
export const requestOtp = (email) => api.post('/auth/request-otp', { email })
export const resendOtp  = (email) => api.post('/auth/resend-otp', { email })
export const verifyOtp  = (email, otp) => api.post('/auth/verify-otp', { email, otp })
export const logoutApi  = () => api.post('/auth/logout')
export const fetchMe    = () => api.get('/auth/me')

export default api
