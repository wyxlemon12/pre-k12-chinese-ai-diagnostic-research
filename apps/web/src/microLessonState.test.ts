import { describe, expect, it } from 'vitest'

import {
  appendClassroomLog,
  buildDraftFormFromPackage,
  buildReflectionPayload,
} from './microLessonState'

describe('microLessonState helpers', () => {
  const packageFixture = {
    id: 'lesson-1',
    status: 'confirmed' as const,
    title: '端午为什么吃粽子',
    theme: '端午节食物',
    age_band: '6岁',
    class_profile: '6岁，粤语和英语环境中的普通话初学者',
    source_materials: [
      {
        kind: 'image' as const,
        title: '粽子图片卡',
        content: '一张桌上放着粽子、龙舟和一家人过节的图片。',
      },
      {
        kind: 'text' as const,
        title: '教师短文',
        content: '端午节的时候，有些家庭会一起吃粽子。',
      },
    ],
    hook: '老师带来一个叶子包着的特别食物。',
    core_question: '为什么有些食物会在端午节这样的特别日子吃？',
    language_goals: [],
    focus_support: [],
    time_blocks: [],
    scaffold_paths: [],
    observation_signals: [],
    teacher_prompt_cards: [],
    student_cards: [],
    reflection_summary: null,
    next_lesson_moves: [],
  }

  it('builds the editor form from the active package instead of leaving stale defaults', () => {
    const draftForm = buildDraftFormFromPackage(packageFixture)

    expect(draftForm.title).toBe('端午为什么吃粽子')
    expect(draftForm.theme).toBe('端午节食物')
    expect(draftForm.source_materials[0]?.content).toContain('粽子')
  })

  it('clears selected students after applying one classroom signal', () => {
    const result = appendClassroomLog({
      logs: [],
      blockId: 'block-small-group',
      signalId: 'needs_visual_support',
      selectedStudentIds: ['student-moon'],
      recommendation: {
        block_id: 'block-small-group',
        signal_id: 'needs_visual_support',
        recommended_path: '图片支持路',
        teacher_move: '先让孩子选图，再说一个关键词。',
        display_prompt: '你觉得它是什么？',
        optional_prompts: ['这是粽子还是苹果？'],
        selected_students: ['student-moon'],
      },
    })

    expect(result.nextSelectedStudentIds).toEqual([])
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0]?.studentIds).toEqual(['student-moon'])
  })

  it('builds reflection payload from the latest signal for each student', () => {
    const reflection = buildReflectionPayload([
      {
        blockId: 'block-hook',
        signalId: 'needs_visual_support',
        studentIds: ['student-moon'],
        recommendation: {
          block_id: 'block-hook',
          signal_id: 'needs_visual_support',
          recommended_path: '图片支持路',
          teacher_move: '先用图片支持。',
          display_prompt: '这是什么？',
          optional_prompts: ['你指一指。'],
          selected_students: ['student-moon'],
        },
      },
      {
        blockId: 'block-small-group',
        signalId: 'can_offer_reason',
        studentIds: ['student-lantern'],
        recommendation: {
          block_id: 'block-small-group',
          signal_id: 'can_offer_reason',
          recommended_path: '原因表达路',
          teacher_move: '把问题缩成一句原因表达。',
          display_prompt: '为什么特别？',
          optional_prompts: ['可以用因为来说吗？'],
          selected_students: ['student-lantern'],
        },
      },
    ])

    expect(reflection.signal_ids).toEqual([
      'needs_visual_support',
      'can_offer_reason',
    ])
    expect(reflection.student_updates).toEqual([
      { student_id: 'student-moon', signal_id: 'needs_visual_support' },
      { student_id: 'student-lantern', signal_id: 'can_offer_reason' },
    ])
  })
})
