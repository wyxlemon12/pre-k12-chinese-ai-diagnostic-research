import { useEffect, useState } from 'react'
import './App.css'

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; environment: string }
  | { status: 'error'; message: string }

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'

function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    async function loadHealth() {
      try {
        const response = await fetch(`${apiBaseUrl}/healthz`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as { status: string; environment: string }
        if (!active) return

        if (data.status === 'ok') {
          setHealth({
            status: 'ok',
            environment: data.environment ?? 'unknown',
          })
          return
        }

        setHealth({
          status: 'error',
          message: 'Unexpected health payload',
        })
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Unknown error'
        setHealth({ status: 'error', message })
      }
    }

    loadHealth()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Pre-K12 Chinese AI Harness</p>
          <h1>React, Python, and Rust are now wired for the next engineering step.</h1>
          <p className="lede">
            This harness turns the PRD into a runnable engineering workspace: a React
            teacher console, a FastAPI service for lesson parsing, and a Rust engine
            for future high-performance text processing.
          </p>
          <div className="hero-actions">
            <a href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer">
              Open API docs
            </a>
            <a
              href="https://github.com/wyxlemon12/pre-k12-chinese-ai-diagnostic-research"
              target="_blank"
              rel="noreferrer"
            >
              View repository
            </a>
          </div>
        </div>
        <div className="status-card">
          <p className="card-label">API status</p>
          {health.status === 'loading' && <strong>Checking FastAPI harness...</strong>}
          {health.status === 'ok' && (
            <>
              <strong>Healthy</strong>
              <span>Environment: {health.environment}</span>
            </>
          )}
          {health.status === 'error' && (
            <>
              <strong>Unavailable</strong>
              <span>{health.message}</span>
            </>
          )}
          <code>{apiBaseUrl}</code>
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <p className="card-label">Frontend</p>
          <h2>React teacher workspace</h2>
          <ul>
            <li>Lesson import, pathway cards, worksheet mapping, and diagnostics UI</li>
            <li>Runs with Vite for fast iteration during demo building</li>
            <li>Ready for richer teacher-facing product flows</li>
          </ul>
        </article>
        <article className="panel">
          <p className="card-label">Backend</p>
          <h2>Python orchestration layer</h2>
          <ul>
            <li>FastAPI service with a lesson parse endpoint and healthcheck</li>
            <li>Natural home for prompts, graph logic, and evidence-chain diagnosis</li>
            <li>Managed with uv for reproducible local setup</li>
          </ul>
        </article>
        <article className="panel">
          <p className="card-label">Engine</p>
          <h2>Rust performance path</h2>
          <ul>
            <li>Dedicated crate for text signal extraction and future offline processing</li>
            <li>Clear boundary for high-performance or local-safe modules</li>
            <li>Installed toolchain is ready for cargo-based development</li>
          </ul>
        </article>
      </section>

      <section className="panel runbook">
        <div>
          <p className="card-label">Runbook</p>
          <h2>Local commands</h2>
        </div>
        <div className="commands">
          <code>pnpm bootstrap</code>
          <code>pnpm dev</code>
          <code>pnpm build</code>
        </div>
        <p className="note">
          The harness is intentionally minimal: enough to verify the stack, enough to
          start implementing the teacher workflow next.
        </p>
      </section>
    </main>
  )
}

export default App
