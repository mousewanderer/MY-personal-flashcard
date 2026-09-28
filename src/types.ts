export type Direction = 'front-back' | 'back-front' | 'mixed'
export type Rating = 'again' | 'hard' | 'good' | 'easy'
export type SrsState = 'new' | 'learning' | 'review' | 'relearning'
export type Strictness = 'strict' | 'normal' | 'lenient'
export type Theme = 'system' | 'light' | 'dark'

export interface CardSet {
  id: string
  title: string
  description: string
  frontLang: string
  backLang: string
  /** Optional labels for filtering; missing on sets made before tags existed. */
  tags?: string[]
  /** Optional exam day ('YYYY-MM-DD'): until then, reviews are never scheduled past it. */
  examDate?: string
  createdAt: number
  updatedAt: number
  deleted: boolean
}

export interface Card {
  id: string
  setId: string
  front: string
  back: string
  /** 0 to 3 wrong answers for multiple choice (written for the back side). */
  options: string[]
  starred: boolean
  position: number
  createdAt: number
  updatedAt: number
  deleted: boolean
}

export interface ReviewState {
  cardId: string
  srsState: SrsState
  due: number
  intervalDays: number
  ease: number
  reps: number
  lapses: number
  learningStep: number
  lastReviewedAt: number | null
  /** FSRS memory, set once the FSRS scheduler has rated the card (see lib/fsrs). */
  stability?: number
  difficulty?: number
}

export interface ReviewLog {
  id?: number
  cardId: string
  setId: string
  timestamp: number
  mode: string
  rating: Rating
  correct: boolean
  wasNew: boolean
  /** Whether this answer changed the card's schedule. */
  scheduled: boolean
}

export interface Settings {
  theme: Theme
  dailyNewLimit: number
  defaultDirection: Direction
  strictness: Strictness
  ignoreAccents: boolean
  /** Unlockable accent colour id (see lib/unlocks); missing means the default. */
  accent?: string
  /** Which spaced repetition scheduler rates cards; missing means classic. */
  scheduler?: 'classic' | 'fsrs'
}

export type AvatarColor = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'teal'

/** The single on-device profile (there are no accounts). */
export interface ProfileSettings {
  name: string
  color: AvatarColor
  dailyGoal: number
}

export interface CardInput {
  front: string
  back: string
  options?: string[]
}

/** Plain text extracted from an imported PDF. Device-only: never in CSV, deleted for real. */
export interface Doc {
  id: string
  title: string
  fileName: string
  text: string
  pages: number
  words: number
  createdAt: number
  updatedAt: number
}

/** An imported song. The audio is kept as a Blob; device-only, never in CSV, deleted for real. */
export interface Track {
  id: string
  title: string
  fileName: string
  type: string
  size: number
  /** Seconds; 0 when the browser couldn't tell. */
  duration: number
  blob: Blob
  position: number
  createdAt: number
}
