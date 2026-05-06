import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-white">Terjadi Kesalahan</h1>
            <p className="text-sm text-zinc-400">
              Aplikasi mengalami error yang tidak terduga. Silakan muat ulang untuk melanjutkan.
            </p>
            {this.state.error && (
              <p className="text-xs text-zinc-600 font-mono mt-2 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-left break-all">
                {this.state.error.message}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </button>
            <button
              onClick={this.handleReset}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    )
  }
}
