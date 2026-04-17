export type MaterialKind = 'image' | 'text' | 'card'

export type SourceMaterial = {
  kind: MaterialKind
  title: string
  content: string
}

export type PackageStatus = 'draft' | 'confirmed'

export type MicroLessonPackage = {
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
  time_blocks: unknown[]
  scaffold_paths: unknown[]
  observation_signals: unknown[]
  teacher_prompt_cards: unknown[]
  student_cards: unknown[]
  reflection_summary: unknown
  next_lesson_moves: string[]
}

export type DraftRequest = {
  title: string
  theme: string
  age_band: string
  class_profile: string
  source_materials: SourceMaterial[]
}

export type ClassroomRecommendation = {
  block_id: string
  signal_id: string
  recommended_path: string
  teacher_move: string
  display_prompt: string
  optional_prompts: string[]
  selected_students: string[]
}

export type ClassroomLog = {
  blockId: string
  signalId: string
  studentIds: string[]
  recommendation: ClassroomRecommendation
}

export function buildDraftFormFromPackage(
  packageData: MicroLessonPackage,
): DraftRequest {
  return {
    title: packageData.title,
    theme: packageData.theme,
    age_band: packageData.age_band,
    class_profile: packageData.class_profile,
    source_materials: packageData.source_materials,
  }
}

export function appendClassroomLog(input: {
  logs: ClassroomLog[]
  blockId: string
  signalId: string
  selectedStudentIds: string[]
  recommendation: ClassroomRecommendation
}) {
  return {
    logs: [
      ...input.logs,
      {
        blockId: input.blockId,
        signalId: input.signalId,
        studentIds: input.selectedStudentIds,
        recommendation: input.recommendation,
      },
    ],
    nextSelectedStudentIds: [] as string[],
  }
}

export function buildReflectionPayload(logs: ClassroomLog[]) {
  const latestByStudent = new Map<string, string>()
  logs.forEach((entry) => {
    entry.studentIds.forEach((studentId) =>
      latestByStudent.set(studentId, entry.signalId),
    )
  })
  return {
    signal_ids: Array.from(new Set(logs.map((entry) => entry.signalId))),
    student_updates: Array.from(latestByStudent.entries()).map(
      ([student_id, signal_id]) => ({
        student_id,
        signal_id,
      }),
    ),
  }
}
