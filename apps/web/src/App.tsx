import { startTransition, useEffect, useState } from 'react'
import './App.css'

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; environment: string }
  | { status: 'error'; message: string }

type ObservationOption = {
  id: string
  label: string
  dimension: string
  look_for: string
}

type WorksheetItem = {
  id: string
  prompt: string
  dimension: string
  error_pattern: string
  recovery_move: string
}

type LessonParseResponse = {
  title: string
  theme: string
  lesson_summary: string
  target_words: string[]
  target_sentences: string[]
  comprehension_goals: string[]
  observation_options: ObservationOption[]
  worksheet_items: WorksheetItem[]
  evidence_sources: string[]
}

type PathwayCard = {
  id: string
  name: string
  learner_profile: string
  scaffolds: string[]
  micro_activity: string
  success_signal: string
}

type LessonPathwaysResponse = {
  title: string
  theme: string
  pathway_cards: PathwayCard[]
}

type WorksheetOutcome = 'secure' | 'partial' | 'stuck'

type WorksheetResult = {
  item_id: string
  outcome: WorksheetOutcome
}

type EvidenceChainItem = {
  evidence: string
  inference: string
  next_move: string
}

type DiagnoseResponse = {
  focus_dimension: string
  teacher_summary: string
  group_signal: string
  evidence_chain: EvidenceChainItem[]
  next_steps: string[]
}

type LessonFormState = {
  title: string
  theme: string
  text: string
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'

const defaultLesson: LessonFormState = {
  title: '我的家',
  theme: '家庭与自我介绍',
  text:
    '这是我的家。我的家里有爸爸、妈妈、哥哥和我。爸爸喜欢看书，妈妈喜欢做饭。哥哥爱踢球，我喜欢画画。我们都爱我们的家。',
}

const worksheetOutcomeLabels: Record<WorksheetOutcome, string> = {
  secure: '稳定完成',
  partial: '部分完成',
  stuck: '明显卡住',
}

async function postJson<TResponse, TPayload>(
  path: string,
  payload: TPayload,
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return (await response.json()) as TResponse
}

function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' })
  const [lessonForm, setLessonForm] = useState<LessonFormState>(defaultLesson)
  const [parseResult, setParseResult] = useState<LessonParseResponse | null>(null)
  const [pathwaysResult, setPathwaysResult] = useState<LessonPathwaysResponse | null>(
    null,
  )
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnoseResponse | null>(null)
  const [selectedObservationIds, setSelectedObservationIds] = useState<string[]>([])
  const [worksheetResults, setWorksheetResults] = useState<Record<string, WorksheetOutcome>>(
    {},
  )
  const [teacherNote, setTeacherNote] = useState('')
  const [loadingStage, setLoadingStage] = useState<'idle' | 'planning' | 'diagnosing'>(
    'idle',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
          setHealth({ status: 'ok', environment: data.environment ?? 'unknown' })
          return
        }

        setHealth({ status: 'error', message: 'Unexpected health payload' })
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

  async function handleGeneratePlan() {
    setLoadingStage('planning')
    setErrorMessage(null)

    try {
      const parsedLesson = await postJson<LessonParseResponse, LessonFormState>(
        '/api/v1/lessons/parse',
        lessonForm,
      )

      const pathways = await postJson<
        LessonPathwaysResponse,
        Pick<
          LessonParseResponse,
          'title' | 'theme' | 'target_words' | 'target_sentences' | 'comprehension_goals'
        >
      >('/api/v1/lessons/pathways', {
        title: parsedLesson.title,
        theme: parsedLesson.theme,
        target_words: parsedLesson.target_words,
        target_sentences: parsedLesson.target_sentences,
        comprehension_goals: parsedLesson.comprehension_goals,
      })

      const seededObservations = parsedLesson.observation_options
        .slice(0, 2)
        .map((option) => option.id)
      const seededWorksheetResults = Object.fromEntries(
        parsedLesson.worksheet_items.map((item, index) => [
          item.id,
          index === 0 ? 'partial' : index === 1 ? 'stuck' : 'secure',
        ]),
      ) as Record<string, WorksheetOutcome>

      startTransition(() => {
        setParseResult(parsedLesson)
        setPathwaysResult(pathways)
        setSelectedObservationIds(seededObservations)
        setWorksheetResults(seededWorksheetResults)
        setDiagnosisResult(null)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成课堂包失败'
      setErrorMessage(message)
    } finally {
      setLoadingStage('idle')
    }
  }

  async function handleGenerateDiagnosis() {
    if (!parseResult) {
      setErrorMessage('请先生成本课三件套。')
      return
    }

    setLoadingStage('diagnosing')
    setErrorMessage(null)

    try {
      const diagnosis = await postJson<
        DiagnoseResponse,
        {
          title: string
          theme: string
          selected_observation_ids: string[]
          worksheet_results: WorksheetResult[]
          teacher_note: string
        }
      >('/api/v1/observations/diagnose', {
        title: parseResult.title,
        theme: parseResult.theme,
        selected_observation_ids: selectedObservationIds,
        worksheet_results: Object.entries(worksheetResults).map(([item_id, outcome]) => ({
          item_id,
          outcome,
        })),
        teacher_note: teacherNote,
      })

      startTransition(() => {
        setDiagnosisResult(diagnosis)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成诊断失败'
      setErrorMessage(message)
    } finally {
      setLoadingStage('idle')
    }
  }

  function toggleObservation(id: string) {
    setSelectedObservationIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function updateWorksheetOutcome(itemId: string, outcome: WorksheetOutcome) {
    setWorksheetResults((current) => ({ ...current, [itemId]: outcome }))
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Teacher Diagnostic Studio</p>
          <h1>把一段中文短文本，变成一节可执行的分层课堂。</h1>
          <p className="lede">
            这一版 demo 不做内容生成器，而是把教师更需要的三件事串起来：
            选出课堂入口、看清孩子卡点、决定下一步怎么补。
          </p>
          <div className="hero-actions">
            <button type="button" onClick={handleGeneratePlan} disabled={loadingStage !== 'idle'}>
              {loadingStage === 'planning' ? '正在生成课堂包…' : '生成本课三件套'}
            </button>
            <a className="secondary-link" href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer">
              查看 API Docs
            </a>
          </div>
        </div>

        <aside className="status-card">
          <p className="card-label">API 状态</p>
          {health.status === 'loading' && <strong>正在检查服务…</strong>}
          {health.status === 'ok' && (
            <>
              <strong>Harness 已连接</strong>
              <span>Environment: {health.environment}</span>
            </>
          )}
          {health.status === 'error' && (
            <>
              <strong>连接失败</strong>
              <span>{health.message}</span>
            </>
          )}
          <code>{apiBaseUrl}</code>
          <p className="status-note">
            当前优先完成前后端闭环；Rust 文本引擎会在下一轮作为增强模块接入。
          </p>
        </aside>
      </section>

      {errorMessage ? (
        <section className="alert-banner" role="alert">
          {errorMessage}
        </section>
      ) : null}

      <section className="workspace">
        <section className="panel composer">
          <div className="section-heading">
            <div>
              <p className="card-label">Step 1</p>
              <h2>文本导入与备课入口</h2>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setLessonForm(defaultLesson)
                setTeacherNote('')
              }}
            >
              还原样本文本
            </button>
          </div>

          <label className="field">
            <span>课文标题</span>
            <input
              value={lessonForm.title}
              onChange={(event) =>
                setLessonForm((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>主题</span>
            <input
              value={lessonForm.theme}
              onChange={(event) =>
                setLessonForm((current) => ({ ...current, theme: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>课文或片段</span>
            <textarea
              rows={8}
              value={lessonForm.text}
              onChange={(event) =>
                setLessonForm((current) => ({ ...current, text: event.target.value }))
              }
            />
          </label>

          <div className="field-note">建议先用一篇 4-6 句的短文本跑第一轮课堂包。</div>

          <div className="mini-grid">
            <article className="mini-card">
              <p className="mini-card-label">本轮目标</p>
              <strong>5 分钟内转成可教结构</strong>
              <span>先固定三件套，再决定路径卡和补救动作。</span>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">儿童体验</p>
              <strong>选择 + 完成 + 正向反馈</strong>
              <span>每个微活动都尽量保持低门槛、小闭环。</span>
            </article>
          </div>
        </section>

        <section className="stack">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="card-label">Step 2</p>
                <h2>本课三件套</h2>
              </div>
              <span className="pill">{parseResult ? '已生成' : '待生成'}</span>
            </div>

            {parseResult ? (
              <div className="content-stack">
                <p className="summary">{parseResult.lesson_summary}</p>

                <div className="chip-group">
                  {parseResult.target_words.map((word) => (
                    <span key={word} className="chip">
                      {word}
                    </span>
                  ))}
                </div>

                <div className="bullet-panel">
                  <h3>目标句</h3>
                  <ul>
                    {parseResult.target_sentences.map((sentence) => (
                      <li key={sentence}>{sentence}</li>
                    ))}
                  </ul>
                </div>

                <div className="bullet-panel">
                  <h3>目标理解点</h3>
                  <ul>
                    {parseResult.comprehension_goals.map((goal) => (
                      <li key={goal}>{goal}</li>
                    ))}
                  </ul>
                </div>

                <div className="bullet-panel">
                  <h3>证据来源</h3>
                  <ul>
                    {parseResult.evidence_sources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="empty-state">
                先点“生成本课三件套”，系统会把文本拆成目标词、目标句和理解目标。
              </p>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="card-label">Step 3</p>
                <h2>能力路径卡</h2>
              </div>
              <span className="pill">{pathwaysResult ? '3 条路径' : '未准备'}</span>
            </div>

            {pathwaysResult ? (
              <div className="pathway-list">
                {pathwaysResult.pathway_cards.map((card) => (
                  <article key={card.id} className="pathway-card">
                    <div className="pathway-header">
                      <h3>{card.name}</h3>
                      <span>{card.learner_profile}</span>
                    </div>
                    <p>{card.micro_activity}</p>
                    <div className="chip-group compact">
                      {card.scaffolds.map((scaffold) => (
                        <span key={scaffold} className="chip subtle">
                          {scaffold}
                        </span>
                      ))}
                    </div>
                    <strong>完成标记：{card.success_signal}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                生成三件套后，这里会自动补出起步支持、标准课堂和延展表达三条路径。
              </p>
            )}
          </section>
        </section>
      </section>

      <section className="workspace lower">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="card-label">Step 4</p>
              <h2>课堂观察与工作纸</h2>
            </div>
            <button
              type="button"
              onClick={handleGenerateDiagnosis}
              disabled={!parseResult || loadingStage !== 'idle'}
            >
              {loadingStage === 'diagnosing' ? '正在生成诊断…' : '生成证据链诊断'}
            </button>
          </div>

          {parseResult ? (
            <div className="content-stack">
              <div className="bullet-panel">
                <h3>观察点打勾</h3>
                <div className="observation-list">
                  {parseResult.observation_options.map((option) => {
                    const selected = selectedObservationIds.includes(option.id)
                    return (
                      <label
                        key={option.id}
                        className={`observation-card${selected ? ' selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleObservation(option.id)}
                        />
                        <div>
                          <strong>{option.label}</strong>
                          <span>{option.dimension}</span>
                          <p>{option.look_for}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="bullet-panel">
                <h3>工作纸映射</h3>
                <div className="worksheet-list">
                  {parseResult.worksheet_items.map((item) => (
                    <article key={item.id} className="worksheet-card">
                      <div>
                        <strong>{item.prompt}</strong>
                        <span>{item.dimension}</span>
                      </div>
                      <div className="select-row">
                        <select
                          value={worksheetResults[item.id] ?? 'secure'}
                          onChange={(event) =>
                            updateWorksheetOutcome(
                              item.id,
                              event.target.value as WorksheetOutcome,
                            )
                          }
                        >
                          {Object.entries(worksheetOutcomeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <p>{item.error_pattern}</p>
                      </div>
                      <small>补救动作：{item.recovery_move}</small>
                    </article>
                  ))}
                </div>
              </div>

              <label className="field">
                <span>教师备注</span>
                <textarea
                  rows={4}
                  value={teacherNote}
                  onChange={(event) => setTeacherNote(event.target.value)}
                  placeholder="例如：两个孩子能跟着做动作，但一开口就停住。"
                />
              </label>
            </div>
          ) : (
            <p className="empty-state">
              先生成本课三件套，观察点和工作纸映射才会基于这节课自动出现。
            </p>
          )}
        </section>

        <section className="panel diagnosis-panel">
          <div className="section-heading">
            <div>
              <p className="card-label">Step 5</p>
              <h2>证据链三段式诊断</h2>
            </div>
            <span className="pill">{diagnosisResult ? diagnosisResult.focus_dimension : '待生成'}</span>
          </div>

          {diagnosisResult ? (
            <div className="content-stack">
              <div className="diagnosis-summary">
                <p className="summary-eyebrow">优先跟进维度</p>
                <strong>{diagnosisResult.teacher_summary}</strong>
                <p>{diagnosisResult.group_signal}</p>
              </div>

              <div className="bullet-panel">
                <h3>证据链</h3>
                <div className="evidence-list">
                  {diagnosisResult.evidence_chain.map((item) => (
                    <article key={item.evidence} className="evidence-card">
                      <p>
                        <span>证据</span>
                        {item.evidence}
                      </p>
                      <p>
                        <span>推断</span>
                        {item.inference}
                      </p>
                      <p>
                        <span>下一步动作</span>
                        {item.next_move}
                      </p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="bullet-panel">
                <h3>下节课建议</h3>
                <ul>
                  {diagnosisResult.next_steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="empty-state">
              勾选课堂观察和工作纸结果后，点击“生成证据链诊断”即可得到低风险教学建议。
            </p>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
