import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // Gemini calls can take longer than regular API calls
})

api.interceptors.request.use((config) => {
  console.debug('[api:start]', config.method?.toUpperCase(), config.url, config.data || '')
  return config
})

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

export default api
