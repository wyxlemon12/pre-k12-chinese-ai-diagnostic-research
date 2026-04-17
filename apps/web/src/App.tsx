import { useEffect, useMemo, useState } from 'react'
import './App.css'
import './MicroLesson.css'
import {
  appendClassroomLog,
  buildDraftFormFromPackage,
  buildReflectionPayload,
} from './microLessonState'

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; environment: string }
  | { status: 'error'; message: string }

type ViewMode = 'editor' | 'classroom' | 'reflection' | 'students' | 'tools'
type PackageStatus = 'draft' | 'confirmed'
type MaterialKind = 'image' | 'text' | 'card'

type SourceMaterial = { kind: MaterialKind; title: string; content: string }

type TimeBlock = {
  id: string
  minutes: string
  title: string
  teacher_goal: string
  display_prompt: string
  teacher_moves: string[]
  child_task: string
}

type ScaffoldPath = {
  id: string
  name: string
  learner_signal: string
  support_tools: string[]
  response_goal: string
  teacher_move: string
  sample_prompt: string
}

type ObservationSignal = { id: string; label: string; summary: string }

type TeacherPromptCard = {
  block_id: string
  objective: string
  optional_prompts: string[]
  support_pivot: string
}

type StudentCard = {
  id: string
  alias: string
  current_support: string
  recent_performance: string
  sticky_points: string[]
  next_move: string
}

type ReflectionSummary = {
  teacher_headline: string
  class_snapshot: string[]
  effective_scaffolds: string[]
  blocked_points: string[]
  next_lesson_moves: string[]
}

type MicroLessonPackage = {
  id: string
  status: PackageStatus
  title: string
  theme: string
  age_band: string
  class_profile: string
  source_materials: SourceMaterial[]
  hook: string
  core_question: string
  language_goals: string[]
  focus_support: string[]
  time_blocks: TimeBlock[]
  scaffold_paths: ScaffoldPath[]
  observation_signals: ObservationSignal[]
  teacher_prompt_cards: TeacherPromptCard[]
  student_cards: StudentCard[]
  reflection_summary: ReflectionSummary | null
  next_lesson_moves: string[]
}

type ClassroomRecommendation = {
  block_id: string
  signal_id: string
  recommended_path: string
  teacher_move: string
  display_prompt: string
  optional_prompts: string[]
  selected_students: string[]
}

type DraftRequest = {
  title: string
  theme: string
  age_band: string
  class_profile: string
  source_materials: SourceMaterial[]
}

type ClassroomLog = {
  blockId: string
  signalId: string
  studentIds: string[]
  recommendation: ClassroomRecommendation
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'

const defaultDraft: DraftRequest = {
  title: '团圆餐桌',
  theme: '节日食物',
  age_band: '6岁',
  class_profile: '粤语和英语环境中的普通话初学者',
  source_materials: [
    {
      kind: 'image',
      title: '月饼图片卡',
      content: '一张摆着月饼和茶杯的课堂图片，孩子能看到月亮、家人和圆圆的点心。',
    },
    {
      kind: 'text',
      title: '教师短文',
      content:
        '中秋节的时候，我们会和家人一起吃月饼。月饼圆圆的，大家会一边说话一边分享。',
    },
  ],
}

const viewLabels: Record<ViewMode, string> = {
  editor: '编辑视图',
  classroom: '课堂运行',
  reflection: '课后反馈',
  students: '学生记录',
  tools: '扩展工具',
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as T
}

async function postJson<T, P>(path: string, payload: P): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as T
}

function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' })
  const [draftForm, setDraftForm] = useState<DraftRequest>(defaultDraft)
  const [packages, setPackages] = useState<MicroLessonPackage[]>([])
  const [activePackage, setActivePackage] = useState<MicroLessonPackage | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('editor')
  const [editableHook, setEditableHook] = useState('')
  const [editableQuestion, setEditableQuestion] = useState('')
  const [currentBlockId, setCurrentBlockId] = useState('')
  const [selectedSignalId, setSelectedSignalId] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [classroomRecommendation, setClassroomRecommendation] =
    useState<ClassroomRecommendation | null>(null)
  const [classroomLogs, setClassroomLogs] = useState<ClassroomLog[]>([])
  const [teacherNote, setTeacherNote] = useState('')
  const [loadingStage, setLoadingStage] = useState<
    'idle' | 'drafting' | 'confirming' | 'routing' | 'reflecting'
  >('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function syncPackageState(packageData: MicroLessonPackage | null) {
    setActivePackage(packageData)
    if (packageData) {
      setDraftForm(buildDraftFormFromPackage(packageData))
    }
    setEditableHook(packageData?.hook ?? '')
    setEditableQuestion(packageData?.core_question ?? '')
    setCurrentBlockId(packageData?.time_blocks[0]?.id ?? '')
    setSelectedSignalId(packageData?.observation_signals[0]?.id ?? '')
    setSelectedStudentIds([])
    setClassroomRecommendation(null)
    setClassroomLogs([])
    setTeacherNote('')
  }

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const [healthData, packageData] = await Promise.all([
          getJson<{ status: string; environment: string }>('/healthz'),
          getJson<MicroLessonPackage[]>('/api/v1/micro-lessons'),
        ])
        if (!mounted) return

        setHealth({ status: 'ok', environment: healthData.environment ?? 'unknown' })
        setPackages(packageData)
        if (packageData[0]) {
          syncPackageState(packageData[0])
        }
      } catch (error) {
        if (!mounted) return

        const message = error instanceof Error ? error.message : 'Unknown error'
        setHealth({ status: 'error', message })
        setErrorMessage('当前无法连接后端，请先启动 API 服务。')
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const currentBlock = useMemo(
    () =>
      activePackage?.time_blocks.find((block) => block.id === currentBlockId) ??
      activePackage?.time_blocks[0] ??
      null,
    [activePackage, currentBlockId],
  )

  const currentPromptCard = useMemo(
    () =>
      activePackage?.teacher_prompt_cards.find(
        (card) => card.block_id === currentBlock?.id,
      ) ?? null,
    [activePackage, currentBlock],
  )

  const selectedSignal = useMemo(
    () =>
      activePackage?.observation_signals.find(
        (signal) => signal.id === selectedSignalId,
      ) ?? null,
    [activePackage, selectedSignalId],
  )

  async function refreshPackages(targetId?: string) {
    const packageData = await getJson<MicroLessonPackage[]>('/api/v1/micro-lessons')
    setPackages(packageData)

    if (targetId) {
      const matched = packageData.find((item) => item.id === targetId)
      if (matched) syncPackageState(matched)
      return
    }

    if (activePackage) {
      const matched = packageData.find((item) => item.id === activePackage.id)
      if (matched) syncPackageState(matched)
    }
  }

  async function handleGenerateDraft() {
    setLoadingStage('drafting')
    setErrorMessage(null)
    try {
      const draft = await postJson<MicroLessonPackage, DraftRequest>(
        '/api/v1/micro-lessons/draft',
        draftForm,
      )
      syncPackageState(draft)
      await refreshPackages(draft.id)
      setViewMode('editor')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '生成建议稿失败')
    } finally {
      setLoadingStage('idle')
    }
  }

  async function handleConfirmPackage() {
    if (!activePackage) return

    setLoadingStage('confirming')
    setErrorMessage(null)
    try {
      const confirmed = await postJson<
        MicroLessonPackage,
        { hook: string; core_question: string }
      >(`/api/v1/micro-lessons/${activePackage.id}/confirm`, {
        hook: editableHook,
        core_question: editableQuestion,
      })
      syncPackageState(confirmed)
      await refreshPackages(confirmed.id)
      setViewMode('classroom')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存正式微课包失败')
    } finally {
      setLoadingStage('idle')
    }
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((item) => item !== studentId)
        : [...current, studentId],
    )
  }

  async function handleApplySignal() {
    if (!activePackage || !currentBlockId || !selectedSignalId) return

    setLoadingStage('routing')
    setErrorMessage(null)
    try {
      const recommendation = await postJson<
        ClassroomRecommendation,
        { block_id: string; signal_id: string; student_ids: string[] }
      >(`/api/v1/micro-lessons/${activePackage.id}/classroom-signal`, {
        block_id: currentBlockId,
        signal_id: selectedSignalId,
        student_ids: selectedStudentIds,
      })
      setClassroomRecommendation(recommendation)
      setClassroomLogs((current) =>
        appendClassroomLog({
          logs: current,
          blockId: currentBlockId,
          signalId: selectedSignalId,
          selectedStudentIds,
          recommendation,
        }).logs,
      )
      setSelectedStudentIds([])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '课中支架切换失败')
    } finally {
      setLoadingStage('idle')
    }
  }

  async function handleGenerateReflection() {
    if (!activePackage) return

    setLoadingStage('reflecting')
    setErrorMessage(null)
    try {
      const reflection = buildReflectionPayload(classroomLogs)
      const updated = await postJson<
        MicroLessonPackage,
        {
          teacher_note: string
          signal_ids: string[]
          student_updates: { student_id: string; signal_id: string }[]
        }
      >(`/api/v1/micro-lessons/${activePackage.id}/reflect`, {
        teacher_note: teacherNote,
        signal_ids: reflection.signal_ids,
        student_updates: reflection.student_updates,
      })
      syncPackageState(updated)
      await refreshPackages(updated.id)
      setViewMode('reflection')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '生成课后反馈失败')
    } finally {
      setLoadingStage('idle')
    }
  }

  function updateMaterialContent(index: number, content: string) {
    setDraftForm((current) => ({
      ...current,
      source_materials: current.source_materials.map((material, itemIndex) =>
        itemIndex === index ? { ...material, content } : material,
      ),
    }))
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Micro Lesson Studio</p>
          <h1>把已有素材整理成一节 10 分钟可直接上手的中文微课。</h1>
          <p className="lede">
            AI 只在幕后整理微课包、课中切换语言支架、课后回写反馈。老师继续自然带课，孩子只承接低门槛探究体验。
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={handleGenerateDraft}
              disabled={loadingStage !== 'idle'}
            >
              {loadingStage === 'drafting' ? '正在整理建议稿…' : '生成微课包建议稿'}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setDraftForm(defaultDraft)
                setTeacherNote('')
                setErrorMessage(null)
              }}
              disabled={loadingStage !== 'idle'}
            >
              还原默认样例
            </button>
          </div>
        </div>

        <aside className="status-card">
          <p className="card-label">运行状态</p>
          {health.status === 'loading' && <strong>正在检查服务…</strong>}
          {health.status === 'ok' && (
            <>
              <strong>微课包服务已连接</strong>
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
            主流程固定为：课前整理课堂包、课中运行课堂、课后回写学生记录。
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
              <h2>教师编辑视图</h2>
            </div>
            <span className="pill">
              {activePackage
                ? activePackage.status === 'draft'
                  ? '建议稿'
                  : '正式课包'
                : '未生成'}
            </span>
          </div>

          <label className="field">
            <span>微课标题</span>
            <input
              value={draftForm.title}
              onChange={(event) =>
                setDraftForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>

          <label className="field">
            <span>主题</span>
            <input
              value={draftForm.theme}
              onChange={(event) =>
                setDraftForm((current) => ({
                  ...current,
                  theme: event.target.value,
                }))
              }
            />
          </label>

          <label className="field">
            <span>年龄段</span>
            <input
              value={draftForm.age_band}
              onChange={(event) =>
                setDraftForm((current) => ({
                  ...current,
                  age_band: event.target.value,
                }))
              }
            />
          </label>

          <label className="field">
            <span>班级画像</span>
            <textarea
              rows={3}
              value={draftForm.class_profile}
              onChange={(event) =>
                setDraftForm((current) => ({
                  ...current,
                  class_profile: event.target.value,
                }))
              }
            />
          </label>

          <div className="field">
            <span>素材输入区</span>
            <div className="material-list">
              {draftForm.source_materials.map((material, index) => (
                <article key={`${material.title}-${index}`} className="material-card">
                  <div className="material-meta">
                    <strong>{material.title}</strong>
                    <span>
                      {material.kind === 'image'
                        ? '图片素材'
                        : material.kind === 'card'
                          ? '卡片素材'
                          : '文字素材'}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={material.content}
                    onChange={(event) =>
                      updateMaterialContent(index, event.target.value)
                    }
                  />
                </article>
              ))}
            </div>
          </div>

          {activePackage ? (
            <div className="content-stack">
              <div className="bullet-panel">
                <h3>建议稿可编辑项</h3>
                <label className="field inline-field">
                  <span>课堂 Hook</span>
                  <textarea
                    rows={3}
                    value={editableHook}
                    onChange={(event) => setEditableHook(event.target.value)}
                  />
                </label>
                <label className="field inline-field">
                  <span>核心问题</span>
                  <textarea
                    rows={2}
                    value={editableQuestion}
                    onChange={(event) => setEditableQuestion(event.target.value)}
                  />
                </label>
              </div>

              <div className="bullet-panel">
                <h3>语言目标</h3>
                <ul>
                  {activePackage.language_goals.map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
              </div>

              <div className="bullet-panel">
                <h3>微技能焦点</h3>
                <ul>
                  {activePackage.focus_support.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={handleConfirmPackage}
                disabled={loadingStage !== 'idle'}
              >
                {loadingStage === 'confirming' ? '正在保存课包…' : '保存为正式微课包'}
              </button>
            </div>
          ) : (
            <p className="empty-state">
              生成建议稿后，老师可以先改 hook 和核心问题，再保存成正式课包。
            </p>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="card-label">Step 2</p>
              <h2>完整微课包</h2>
            </div>
            <div className="tab-row">
              {(Object.keys(viewLabels) as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={viewMode === mode ? 'tab-button active' : 'tab-button'}
                  onClick={() => setViewMode(mode)}
                  disabled={!activePackage && mode !== 'tools'}
                >
                  {viewLabels[mode]}
                </button>
              ))}
            </div>
          </div>

          {!activePackage && viewMode !== 'tools' ? (
            <p className="empty-state">
              这里会显示可保存、可运行、可复盘的完整微课包。
            </p>
          ) : viewMode === 'editor' ? (
            <div className="content-stack">
              <div className="diagnosis-summary editor-summary">
                <p className="summary-eyebrow">建议稿摘要</p>
                <strong>{editableHook}</strong>
                <p>{editableQuestion}</p>
              </div>

              <div className="bullet-panel">
                <h3>课前整理好的素材</h3>
                <div className="material-list">
                  {activePackage?.source_materials.map((material) => (
                    <article
                      key={`${activePackage.id}-${material.title}`}
                      className="material-card"
                    >
                      <div className="material-meta">
                        <strong>{material.title}</strong>
                        <span>{material.kind}</span>
                      </div>
                      <p className="summary">{material.content}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="bullet-panel">
                <h3>10 分钟流程</h3>
                <div className="timeline-list">
                  {activePackage?.time_blocks.map((block) => (
                    <article key={block.id} className="timeline-card">
                      <div>
                        <strong>
                          {block.minutes} · {block.title}
                        </strong>
                        <p>{block.teacher_goal}</p>
                      </div>
                      <span>{block.child_task}</span>
                    </article>
                  ))}
                </div>
              </div>

              <div className="bullet-panel">
                <h3>同题不同支架</h3>
                <div className="pathway-list">
                  {activePackage?.scaffold_paths.map((path) => (
                    <article key={path.id} className="pathway-card">
                      <div className="pathway-header">
                        <h3>{path.name}</h3>
                        <span>{path.learner_signal}</span>
                      </div>
                      <p>{path.response_goal}</p>
                      <div className="chip-group compact">
                        {path.support_tools.map((tool) => (
                          <span key={tool} className="chip subtle">
                            {tool}
                          </span>
                        ))}
                      </div>
                      <strong>教师动作：{path.teacher_move}</strong>
                    </article>
                  ))}
                </div>
              </div>

              <div className="bullet-panel">
                <h3>课中观察信号</h3>
                <ul>
                  {activePackage?.observation_signals.map((signal) => (
                    <li key={signal.id}>
                      {signal.label}：{signal.summary}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : viewMode === 'classroom' ? (
            <div className="content-stack">
              <div className="classroom-layout">
                <section className="classroom-stage">
                  <p className="card-label">主屏</p>
                  <h3>{currentBlock?.title ?? '课堂运行'}</h3>
                  <strong className="stage-question">
                    {currentBlock?.display_prompt ?? activePackage?.core_question}
                  </strong>
                  <p className="stage-hook">{activePackage?.hook}</p>
                  <div className="chip-group">
                    {activePackage?.focus_support.map((item) => (
                      <span key={item} className="chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="classroom-control">
                  <p className="card-label">教师控制端</p>
                  <label className="field inline-field">
                    <span>当前环节</span>
                    <select
                      value={currentBlockId}
                      onChange={(event) => setCurrentBlockId(event.target.value)}
                    >
                      {activePackage?.time_blocks.map((block) => (
                        <option key={block.id} value={block.id}>
                          {block.minutes} · {block.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="bullet-panel compact-panel">
                    <h3>当前目标</h3>
                    <p>{currentPromptCard?.objective ?? currentBlock?.teacher_goal}</p>
                  </div>

                  <div className="bullet-panel compact-panel">
                    <h3>如果孩子卡住，就这样做</h3>
                    <p>
                      {classroomRecommendation?.teacher_move ??
                        currentPromptCard?.support_pivot}
                    </p>
                  </div>

                  <div className="bullet-panel compact-panel">
                    <h3>可选追问方向</h3>
                    <ul>
                      {(
                        classroomRecommendation?.optional_prompts ??
                        currentPromptCard?.optional_prompts ??
                        []
                      ).map((prompt) => (
                        <li key={prompt}>{prompt}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bullet-panel compact-panel">
                    <h3>课中极轻量点选</h3>
                    <div className="signal-list">
                      {activePackage?.observation_signals.map((signal) => (
                        <button
                          key={signal.id}
                          type="button"
                          className={
                            selectedSignalId === signal.id
                              ? 'signal-chip active'
                              : 'signal-chip'
                          }
                          onClick={() => setSelectedSignalId(signal.id)}
                        >
                          {signal.label}
                        </button>
                      ))}
                    </div>
                    {selectedSignal ? (
                      <p className="empty-inline">{selectedSignal.summary}</p>
                    ) : null}
                  </div>

                  <div className="bullet-panel compact-panel">
                    <h3>学生记录区（课堂中轻量勾选）</h3>
                    <div className="student-pick-list">
                      {activePackage?.student_cards.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          className={
                            selectedStudentIds.includes(student.id)
                              ? 'student-chip active'
                              : 'student-chip'
                          }
                          onClick={() => toggleStudent(student.id)}
                        >
                          {student.alias}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplySignal}
                    disabled={loadingStage !== 'idle'}
                  >
                    {loadingStage === 'routing' ? '正在更新支架…' : '应用课堂观察'}
                  </button>
                </section>
              </div>

              {classroomRecommendation ? (
                <div className="diagnosis-summary classroom-summary">
                  <p className="summary-eyebrow">系统建议</p>
                  <strong>{classroomRecommendation.recommended_path}</strong>
                  <p>{classroomRecommendation.teacher_move}</p>
                </div>
              ) : null}

              <div className="bullet-panel">
                <h3>课堂日志</h3>
                {classroomLogs.length === 0 ? (
                  <p className="empty-inline">
                    课堂中只要点 1-2 次观察信号，系统就会在后台切换下一步支架建议。
                  </p>
                ) : (
                  <div className="timeline-list">
                    {classroomLogs.map((entry, index) => (
                      <article
                        key={`${entry.blockId}-${entry.signalId}-${index}`}
                        className="timeline-card"
                      >
                        <div>
                          <strong>{entry.recommendation.recommended_path}</strong>
                          <p>{entry.recommendation.teacher_move}</p>
                        </div>
                        <span>
                          {entry.studentIds.length > 0
                            ? '已标记个别学生'
                            : '面向当前小组'}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <label className="field">
                <span>教师备注</span>
                <textarea
                  rows={3}
                  value={teacherNote}
                  onChange={(event) => setTeacherNote(event.target.value)}
                  placeholder="例如：小月亮需要图片支持，小灯笼已经能说出简单原因。"
                />
              </label>

              <button
                type="button"
                onClick={handleGenerateReflection}
                disabled={loadingStage !== 'idle' || classroomLogs.length === 0}
              >
                {loadingStage === 'reflecting'
                  ? '正在生成课后反馈…'
                  : '生成课后反馈'}
              </button>
            </div>
          ) : viewMode === 'reflection' ? (
            <div className="content-stack">
              {activePackage?.reflection_summary ? (
                <>
                  <div className="diagnosis-summary">
                    <p className="summary-eyebrow">课后反馈</p>
                    <strong>{activePackage.reflection_summary.teacher_headline}</strong>
                    <p>{activePackage.next_lesson_moves[0]}</p>
                  </div>

                  <div className="bullet-panel">
                    <h3>课堂快照</h3>
                    <ul>
                      {activePackage.reflection_summary.class_snapshot.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="dual-panel">
                    <article className="bullet-panel">
                      <h3>有效支架</h3>
                      <ul>
                        {activePackage.reflection_summary.effective_scaffolds.map(
                          (item) => (
                            <li key={item}>{item}</li>
                          ),
                        )}
                      </ul>
                    </article>

                    <article className="bullet-panel">
                      <h3>当前卡点</h3>
                      <ul>
                        {activePackage.reflection_summary.blocked_points.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  </div>

                  <div className="bullet-panel">
                    <h3>下一节课建议</h3>
                    <ul>
                      {activePackage.next_lesson_moves.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="empty-state">
                  先在课堂运行页完成一次课堂观察，系统才会把反馈回写进这份微课包。
                </p>
              )}
            </div>
          ) : viewMode === 'students' ? (
            <div className="content-stack">
              <div className="section-heading">
                <div>
                  <p className="card-label">Profiles</p>
                  <h2>学生记录区</h2>
                </div>
                <span className="pill">轻量画像，不做完整登录</span>
              </div>

              <div className="student-grid">
                {activePackage?.student_cards.map((student) => (
                  <article key={student.id} className="student-card">
                    <div className="student-card-head">
                      <strong>{student.alias}</strong>
                      <span>{student.current_support}</span>
                    </div>
                    <p>{student.recent_performance}</p>
                    <div className="chip-group compact">
                      {student.sticky_points.map((item) => (
                        <span key={item} className="chip subtle">
                          {item}
                        </span>
                      ))}
                    </div>
                    <small>下一步：{student.next_move}</small>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="content-stack">
              <div className="bullet-panel">
                <h3>扩展工具页</h3>
                <p className="empty-inline">
                  这些能力会独立成工具页，不进入首个 10 分钟微课主流程。
                </p>
              </div>

              <div className="tool-grid">
                <article className="tool-card">
                  <strong>儿童语音识别</strong>
                  <p>课后或单独站点使用，做朗读样本和轻量反馈。</p>
                </article>
                <article className="tool-card">
                  <strong>笔画跟随</strong>
                  <p>作为独立工具页接入，不打断主课堂节奏。</p>
                </article>
                <article className="tool-card">
                  <strong>拼音 / 声调辅助</strong>
                  <p>只作为课后巩固或教师补充资源，不作为课堂主任务。</p>
                </article>
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="workspace lower">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="card-label">Saved Packages</p>
              <h2>已保存微课包</h2>
            </div>
            <span className="pill">{packages.length} 份</span>
          </div>

          {packages.length === 0 ? (
            <p className="empty-state">
              暂时还没有保存过的课堂包。先生成建议稿并确认成正式课包，这里就会出现可再次打开的微课记录。
            </p>
          ) : (
            <div className="saved-list">
              {packages.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    activePackage?.id === item.id ? 'saved-card active' : 'saved-card'
                  }
                  onClick={() => {
                    syncPackageState(item)
                    setViewMode('editor')
                  }}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.theme} · {item.age_band}
                    </p>
                  </div>
                  <span>{item.status === 'confirmed' ? '正式课包' : '建议稿'}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="section-heading">
            <div>
              <p className="card-label">Checklist</p>
              <h2>Demo 对齐点</h2>
            </div>
          </div>

          <div className="mini-grid">
            <article className="mini-card">
              <p className="mini-card-label">产物</p>
              <strong>完整微课包</strong>
              <span>生成、保存、打开、复盘都围绕同一份课包。</span>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">课堂</p>
              <strong>老师主导</strong>
              <span>AI 只给动作建议，不在课堂前台替老师说话。</span>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">分层</p>
              <strong>语言支架分流</strong>
              <span>同题共学，依据课中信号切换支架层。</span>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">画像</p>
              <strong>学生记录可见</strong>
              <span>保留个体反馈承接，但暂不做完整身份系统。</span>
            </article>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default App
