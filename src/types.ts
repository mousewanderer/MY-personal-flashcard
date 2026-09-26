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
}

export interface CardInput {
  front: string
  back: string
  options?: string[]
}
