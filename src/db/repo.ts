import type { Card, CardInput, CardSet, Doc, ProfileSettings, Rating, ReviewState, Settings, Track } from '../types'
import { DAILY_MODE } from '../lib/daily'
import { capForExam } from '../lib/exam'
import { wordCount } from '../lib/pdfText'
import { initialReview, schedule, startOfDay } from '../lib/scheduler'
import { shouldUpdateSchedule } from '../lib/session'
import { hasTag } from '../lib/tags'
import { db } from './db'

export const newId = () => crypto.randomUUID()

// ---------- settings and small values ----------

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  dailyNewLimit: 20,
  defaultDirection: 'front-back',
  strictness: 'normal',
  ignoreAccents: false,
}

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await db.kv.put({ key: 'settings', value: { ...(await getSettings()), ...patch } })
}

export const DEFAULT_PROFILE: ProfileSettings = { name: 'Learner', color: 'blue', dailyGoal: 20 }

export async function saveProfile(patch: Partial<ProfileSettings>): Promise<void> {
  const row = await db.kv.get('profile')
  await db.kv.put({ key: 'profile', value: { ...DEFAULT_PROFILE, ...(row?.value as object | undefined), ...patch } })
}

export async function getValue<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined
}

export async function setValue(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value })
}

// ---------- sets ----------

export async function createSet(title: string, description = '', tags: string[] = [], examDate?: string): Promise<string> {
  const t = Date.now()
  const id = newId()
  await db.sets.add({
    id, title: title.trim() || 'Untitled set', description: description.trim(), tags, examDate,
    frontLang: 'en-US', backLang: 'en-US', createdAt: t, updatedAt: t, deleted: false,
  })
  return id
}

/** Cards (not deleted) of every set that is not deleted, optionally only sets with `tag`. */
export async function cardsForTag(tag?: string | null): Promise<Card[]> {
  const sets = (await db.sets.toArray()).filter((s) => !s.deleted && hasTag(s, tag))
  const ids = new Set(sets.map((s) => s.id))
  return (await db.cards.toArray()).filter((c) => !c.deleted && ids.has(c.setId))
}

/** Every daily challenge answer, for the streak and today's progress. */
export const dailyLogs = () => db.logs.filter((l) => l.mode === DAILY_MODE).toArray()

export async function updateSet(id: string, patch: Partial<Pick<CardSet, 'title' | 'description' | 'tags' | 'examDate'>>): Promise<void> {
  await db.sets.update(id, { ...patch, updatedAt: Date.now() })
}

/** Soft delete: the set and its cards become tombstones. */
export async function deleteSet(id: string): Promise<void> {
  const t = Date.now()
  await db.transaction('rw', db.sets, db.cards, async () => {
    await db.sets.update(id, { deleted: true, updatedAt: t })
    await db.cards.where('setId').equals(id).modify({ deleted: true, updatedAt: t })
  })
}

export async function duplicateSet(id: string): Promise<string> {
  const set = await db.sets.get(id)
  if (!set) throw new Error('Set not found')
  const cards = await setCards(id)
  const newSetId = await createSet(`${set.title} (copy)`, set.description)
  await addCards(newSetId, cards)
  return newSetId
}

// ---------- cards ----------

export async function setCards(setId: string): Promise<Card[]> {
  const cards = await db.cards.where('setId').equals(setId).toArray()
  return cards.filter((c) => !c.deleted).sort((a, b) => a.position - b.position)
}

export async function addCards(setId: string, inputs: CardInput[]): Promise<void> {
  const t = Date.now()
  await db.transaction('rw', db.cards, db.sets, async () => {
    const existing = await db.cards.where('setId').equals(setId).toArray()
    let pos = existing.reduce((m, c) => Math.max(m, c.position), -1) + 1
    await db.cards.bulkAdd(
      inputs.map((c) => ({
        id: newId(), setId, front: c.front.trim(), back: c.back.trim(),
        options: (c.options ?? []).map((o) => o.trim()).filter(Boolean).slice(0, 3),
        starred: false, position: pos++, createdAt: t, updatedAt: t, deleted: false,
      })),
    )
    await db.sets.update(setId, { updatedAt: t })
  })
}

export async function updateCard(
  id: string,
  patch: Partial<Pick<Card, 'front' | 'back' | 'options' | 'starred'>>,
): Promise<void> {
  await db.cards.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteCard(id: string): Promise<void> {
  await db.cards.update(id, { deleted: true, updatedAt: Date.now() })
}

/** Swap a card with its neighbour (delta -1 = up, 1 = down). */
export async function moveCard(setId: string, id: string, delta: -1 | 1): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const cards = await setCards(setId)
    const i = cards.findIndex((c) => c.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= cards.length) return
    const t = Date.now()
    await db.cards.update(cards[i].id, { position: cards[j].position, updatedAt: t })
    await db.cards.update(cards[j].id, { position: cards[i].position, updatedAt: t })
  })
}

// ---------- reviews ----------

export async function reviewsFor(cardIds: string[]): Promise<Map<string, ReviewState>> {
  const rows = await db.reviews.bulkGet(cardIds)
  return new Map(rows.filter((r): r is ReviewState => !!r).map((r) => [r.cardId, r]))
}

/** Distinct new cards that got scheduled today (counts toward the daily new-card limit). */
export async function newCardsIntroducedToday(): Promise<number> {
  const logs = await db.logs.where('timestamp').aboveOrEqual(startOfDay(Date.now())).toArray()
  return new Set(logs.filter((l) => l.wasNew && l.scheduled).map((l) => l.cardId)).size
}

/**
 * Logs every answer and updates the schedule when the mode rule allows it
 * (see shouldUpdateSchedule). Returns the new review state if it changed.
 */
export async function recordAnswer(args: {
  card: Card
  mode: string
  correct: boolean
  rating?: Rating
  practiceAhead?: boolean
}): Promise<ReviewState | undefined> {
  const { card, mode, correct, practiceAhead = false } = args
  const rating: Rating = args.rating ?? (correct ? 'good' : 'again')
  const t = Date.now()
  return db.transaction('rw', db.reviews, db.logs, db.sets, async () => {
    const prev = (await db.reviews.get(card.id)) ?? initialReview(card.id)
    const scheduled = shouldUpdateSchedule(mode, prev, t, practiceAhead)
    let next: ReviewState | undefined
    if (scheduled) {
      const examDate = (await db.sets.get(card.setId))?.examDate
      next = capForExam(schedule(prev, rating, t), examDate, t)
      await db.reviews.put(next)
    }
    await db.logs.add({
      cardId: card.id, setId: card.setId, timestamp: t, mode, rating, correct,
      wasNew: prev.srsState === 'new', scheduled,
    })
    return next
  })
}

// ---------- docs (device-only, so deletes are real, not tombstones) ----------

export async function addDoc(input: Pick<Doc, 'title' | 'fileName' | 'text' | 'pages'>): Promise<string> {
  const id = newId()
  const t = Date.now()
  await db.docs.add({ ...input, id, words: wordCount(input.text), createdAt: t, updatedAt: t })
  return id
}

export async function renameDoc(id: string, title: string): Promise<void> {
  await db.docs.update(id, { title, updatedAt: Date.now() })
}

export async function deleteDoc(id: string): Promise<void> {
  await db.docs.delete(id)
}

// ---------- music (device-only, so deletes are real) ----------

export async function addTracks(inputs: Omit<Track, 'id' | 'position' | 'createdAt'>[]): Promise<string[]> {
  return db.transaction('rw', db.tracks, async () => {
    const last = await db.tracks.orderBy('position').last()
    let pos = (last?.position ?? -1) + 1
    const t = Date.now()
    const rows = inputs.map((input): Track => ({ ...input, id: newId(), position: pos++, createdAt: t }))
    await db.tracks.bulkAdd(rows)
    return rows.map((r) => r.id)
  })
}

export async function renameTrack(id: string, title: string): Promise<void> {
  await db.tracks.update(id, { title })
}

export async function deleteTrack(id: string): Promise<void> {
  await db.tracks.delete(id)
}

// ---------- first run ----------

const SAMPLE: CardInput[] = [
  { front: 'hello', back: 'hola', options: ['adiós', 'gracias'] },
  { front: 'thank you', back: 'gracias' },
  { front: 'goodbye', back: 'adiós' },
  { front: 'please', back: 'por favor' },
  { front: 'cat', back: 'gato', options: ['perro', 'pato'] },
  { front: 'dog', back: 'perro' },
  { front: 'water', back: 'agua' },
  { front: 'year', back: 'año' },
]

export async function ensureFirstRun(): Promise<void> {
  const seeded = await db.transaction('rw', db.kv, db.sets, db.cards, async () => {
    if (await db.kv.get('seeded')) return false
    await db.kv.put({ key: 'seeded', value: true })
    const id = await createSet('Sample: Spanish basics', 'A small set to try the study modes. Delete it any time.')
    await db.sets.update(id, { backLang: 'es-ES' })
    await addCards(id, SAMPLE)
    return true
  })
  if (seeded) await navigator.storage?.persist?.().catch(() => false)
}
