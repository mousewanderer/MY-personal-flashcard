import type { ComponentType } from 'react'
import type { IconName } from '../components/Icon'
import Flashcards from './Flashcards'
import MatchList from './MatchList'
import MultipleChoice from './MultipleChoice'
import Writing from './Writing'
import type { ModeProps } from './types'

export type ModeGroup = 'study' | 'game'

export interface ModeInfo {
  id: string
  name: string
  description: string
  group: ModeGroup
  icon: IconName
  minCards: number
  component: ComponentType<ModeProps>
}

// Rename modes here; the id is stored in the review log, so keep it stable.
export const MODES: ModeInfo[] = [
  {
    id: 'flashcards',
    name: 'Flashcards',
    description: 'Flip each card and rate how well you knew it. Due cards come first.',
    group: 'study',
    icon: 'flashcards',
    minCards: 1,
    component: Flashcards,
  },
  {
    id: 'choice',
    name: 'Multiple Choice',
    description: 'Pick the right answer out of four.',
    group: 'study',
    icon: 'choice',
    minCards: 2,
    component: MultipleChoice,
  },
  {
    id: 'writing',
    name: 'Writing',
    description: 'Type each answer from memory. Small typos are forgiven.',
    group: 'study',
    icon: 'writing',
    minCards: 1,
    component: Writing,
  },
  {
    id: 'matchlist',
    name: 'Match List',
    description: 'Connect each term to its definition across two columns.',
    group: 'study',
    icon: 'matchlist',
    minCards: 2,
    component: MatchList,
  },
]

export const modeById = (id: string) => MODES.find((m) => m.id === id)
