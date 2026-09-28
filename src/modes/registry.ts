import type { ComponentType } from 'react'
import type { IconName } from '../components/Icon'
import Boss from './Boss'
import Duel from './Duel'
import Flashcards from './Flashcards'
import Hangman from './Hangman'
import Learn from './Learn'
import LetterWheel from './LetterWheel'
import MatchList from './MatchList'
import Memory from './Memory'
import Meteor from './Meteor'
import MultipleChoice from './MultipleChoice'
import TimeAttack from './TimeAttack'
import WordScramble from './WordScramble'
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
  /** false: answers are not written to the review log (and the mode is left out of the Explorer badge). */
  logged?: false
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
    id: 'learn',
    name: 'Learn',
    description: 'Rounds of 7: pick the answer first, then type it, until every card is learned.',
    group: 'study',
    icon: 'learn',
    minCards: 2,
    component: Learn,
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
  {
    id: 'scramble',
    name: 'Word Scramble',
    description: 'Rebuild the answer from its shuffled letters.',
    group: 'game',
    icon: 'scramble',
    minCards: 1,
    component: WordScramble,
  },
  {
    id: 'hangman',
    name: 'Hangman',
    description: 'Uncover the answer one letter at a time before your lives run out.',
    group: 'game',
    icon: 'hangman',
    minCards: 1,
    component: Hangman,
  },
  {
    id: 'wheel',
    name: 'Letter Wheel',
    description: 'Go around the alphabet: each answer starts with the highlighted letter.',
    group: 'game',
    icon: 'wheel',
    minCards: 2,
    component: LetterWheel,
  },
  {
    id: 'timeattack',
    name: 'Time Attack',
    description: 'Match as many pairs as you can in 60 seconds.',
    group: 'game',
    icon: 'timer',
    minCards: 2,
    component: TimeAttack,
  },
  {
    id: 'meteor',
    name: 'Meteor',
    description: 'Type the answer before the falling terms land. Three lives, faster every level.',
    group: 'game',
    icon: 'meteor',
    minCards: 1,
    component: Meteor,
  },
  {
    id: 'boss',
    name: 'Boss Battle',
    description: 'Answer to hit the boss. Streaks hit harder; misses and slow answers cost a heart.',
    group: 'game',
    icon: 'boss',
    minCards: 2,
    component: Boss,
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Flip the tiles two at a time to find each term and its answer.',
    group: 'game',
    icon: 'memory',
    minCards: 2,
    component: Memory,
  },
  {
    id: 'duel',
    name: 'Duel',
    description: 'Two players, one device: first to tap the right answer scores. Not saved to your stats.',
    group: 'game',
    icon: 'duel',
    minCards: 2,
    component: Duel,
    logged: false,
  },
]

export const modeById = (id: string) => MODES.find((m) => m.id === id)
