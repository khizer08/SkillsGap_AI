import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Something went wrong while rendering this page.',
    }
  }

  componentDidCatch(error, info) {
    console.error('[ui:error-boundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="card">
          <p className="text-lg font-semibold text-slate-200 mb-2">We hit a display issue.</p>
          <p className="text-sm text-slate-500 mb-6">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </main>
    )
  }
}
