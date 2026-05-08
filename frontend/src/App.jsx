import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import UploadPage from './pages/UploadPage'
import DashboardPage from './pages/DashboardPage'
import RoadmapPage from './pages/RoadmapPage'
import InterviewPage from './pages/InterviewPage'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  // Global app state shared across pages
  const [appState, setAppState] = useState({
    sessionId: null,
    resumeData: null,      // { skills, technologies, frameworks, projects }
    analysisData: null,    // skill gap result
    roadmapData: null,     // generated roadmap
    roadmapStatus: 'idle', // idle | generating | ready | error
    roadmapError: '',
    selectedRole: null,
  })

  const updateState = (patch) => setAppState(prev => ({ ...prev, ...patch }))

  return (
    <AuthProvider>
      <div className="min-h-screen bg-mesh">
        <Navbar appState={appState} />
        <ErrorBoundary>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected */}
            <Route path="/"          element={<ProtectedRoute><UploadPage    appState={appState} updateState={updateState} /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage appState={appState} updateState={updateState} /></ProtectedRoute>} />
            <Route path="/roadmap"   element={<ProtectedRoute><RoadmapPage   appState={appState} updateState={updateState} /></ProtectedRoute>} />
            <Route path="/interview" element={<ProtectedRoute><InterviewPage appState={appState} updateState={updateState} /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </AuthProvider>
  )
}

