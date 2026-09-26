import Dexie, { type EntityTable } from 'dexie'
import type { Card, CardSet, Doc, ReviewLog, ReviewState, Track } from '../types'

export interface KV {
  key: string
  value: unknown
}

export const db = new Dexie('flashcards') as Dexie & {
  sets: EntityTable<CardSet, 'id'>
  cards: EntityTable<Card, 'id'>
  reviews: EntityTable<ReviewState, 'cardId'>
  logs: EntityTable<ReviewLog, 'id'>
  kv: EntityTable<KV, 'key'>
  docs: EntityTable<Doc, 'id'>
  tracks: EntityTable<Track, 'id'>
}

db.version(1).stores({
  sets: 'id',
  cards: 'id, setId',
  reviews: 'cardId',
  logs: '++id, cardId, timestamp',
  kv: 'key',
})

db.version(2).stores({
  docs: 'id, createdAt',
})

db.version(3).stores({
  tracks: 'id, position',
})
