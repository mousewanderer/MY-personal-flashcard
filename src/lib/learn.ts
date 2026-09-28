/**
 * Learn mode: each card goes from multiple choice to a typed answer.
 * Stage 0: not answered right yet (asked as multiple choice).
 * Stage 1: multiple choice right (asked as a typed answer).
 * Stage 2: typed right, learned for this session.
 */
export type LearnStage = 0 | 1 | 2

export const LEARNED: LearnStage = 2
export const LEARN_ROUND_SIZE = 7

export type QuestionKind = 'choice' | 'write'

/** Correct moves a card one stage on; wrong keeps it where it is. */
export const advance = (stage: LearnStage, correct: boolean): LearnStage =>
  correct ? (Math.min(stage + 1, LEARNED) as LearnStage) : stage

/** Multiple choice until it is answered right, unless there are not two distinct options to pick from. */
export const questionKind = (stage: LearnStage, optionCount: number): QuestionKind =>
  stage === 0 && optionCount >= 2 ? 'choice' : 'write'

/**
 * The next round, keeping session order: cards already asked but not learned come back first,
 * then cards not asked yet. `stages` has an entry only for cards that were asked.
 */
export function nextRound<T extends { key: string }>(
  items: T[],
  stages: Map<string, LearnStage>,
  size = LEARN_ROUND_SIZE,
): T[] {
  const started = items.filter((it) => stages.has(it.key) && stages.get(it.key)! < LEARNED)
  const fresh = items.filter((it) => !stages.has(it.key))
  return [...started, ...fresh].slice(0, size)
}

export interface LearnProgress {
  learned: number
  /** Past multiple choice, not yet typed right. */
  familiar: number
  total: number
}

export function learnProgress(keys: string[], stages: Map<string, LearnStage>): LearnProgress {
  let learned = 0
  let familiar = 0
  for (const k of keys) {
    const s = stages.get(k)
    if (s === LEARNED) learned++
    else if (s === 1) familiar++
  }
  return { learned, familiar, total: keys.length }
}
