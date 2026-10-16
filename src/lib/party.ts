// Hotspot play: one phone hosts, up to three more join over Wi-Fi, and everyone answers every question
// on their own phone. The host runs the game; guests only show what it sends and report their answers.
import { DUEL_HP, hitTarget, isBattle, type DuelGame } from './duel'

export const PARTY_MAX = 4
export const PARTY_TARGET = 10
export const PARTY_CHOICE_MS = 15_000
export const PARTY_SCRAMBLE_MS = 45_000
export const PARTY_RESULT_MS = 2_500
/** The fastest right answer hits this much harder in a battle. */
export const FASTEST_BONUS = 1.5
const VERSION = 1

/** Player ids are connection ids; the host is 0. */
export interface PartyPlayer {
  id: number
  name: string
  left?: boolean
}

export interface PartyQuestion {
  n: number
  prompt: string
  answer: string
  /** Multiple choice: the options and the right one. */
  options?: string[]
  correct?: number
  /** Scramble: the shuffled letters. */
  tiles?: string[]
  ms: number
  damage: number
}

export interface PartyAnswer {
  ok: boolean
  ms: number
}

export interface PartyHit {
  from: number
  to: number
  damage: number
}

export interface PartyResult {
  n: number
  /** Ids of the right answers, fastest first. */
  right: number[]
  hits: PartyHit[]
}

export type Tally = Record<number, number>

export type HostMsg =
  | { t: 'lobby'; you: number; game: DuelGame; players: PartyPlayer[] }
  | { t: 'full' }
  | { t: 'question'; game: DuelGame; q: PartyQuestion; players: PartyPlayer[]; scores: Tally; hp: Tally }
  | { t: 'result'; r: PartyResult; scores: Tally; hp: Tally }
  | { t: 'end'; winner: number | null; players: PartyPlayer[]; scores: Tally; hp: Tally }
  | { t: 'bye' }

export type GuestMsg = { t: 'hello'; v: number; name: string } | { t: 'answer'; n: number; ok: boolean; ms: number }

export const helloMsg = (name: string): GuestMsg => ({ t: 'hello', v: VERSION, name })

function parse(data: string): Record<string, unknown> | null {
  try {
    const m: unknown = JSON.parse(data)
    return m && typeof m === 'object' && typeof (m as { t?: unknown }).t === 'string' ? (m as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** A guest's message, or null when it isn't one this version understands. */
export function parseGuestMsg(data: string): GuestMsg | null {
  const m = parse(data)
  if (m?.t === 'hello' && m.v === VERSION && typeof m.name === 'string') return { t: 'hello', v: VERSION, name: m.name }
  if (m?.t === 'answer' && typeof m.n === 'number' && typeof m.ok === 'boolean' && typeof m.ms === 'number') {
    return { t: 'answer', n: m.n, ok: m.ok, ms: m.ms }
  }
  return null
}

const HOST_TYPES = new Set(['lobby', 'full', 'question', 'result', 'end', 'bye'])

/** The host's message. Only the type is checked: the host runs the same app version. */
export function parseHostMsg(data: string): HostMsg | null {
  const m = parse(data)
  return m && HOST_TYPES.has(m.t as string) ? (m as unknown as HostMsg) : null
}

export const activePlayers = (players: PartyPlayer[]) => players.filter((p) => !p.left)

/** Players still answering: not gone, and in a battle not knocked out. */
export const standingPlayers = (players: PartyPlayer[], game: DuelGame, hp: Tally) =>
  activePlayers(players).filter((p) => !isBattle(game) || (hp[p.id] ?? 0) > 0)

export const canJoin = (players: PartyPlayer[]) => activePlayers(players).length < PARTY_MAX

/** Adds a player with a tidy, unique name, or returns null when the game is full. */
export function joinPlayer(players: PartyPlayer[], id: number, rawName: string): PartyPlayer[] | null {
  if (!canJoin(players)) return null
  const base = rawName.trim().slice(0, 16) || `Player ${players.length + 1}`
  const taken = new Set(activePlayers(players).map((p) => p.name.toLowerCase()))
  let name = base
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} ${i}`
  return [...players.filter((p) => p.id !== id), { id, name }]
}

export function freshTally(players: PartyPlayer[], game: DuelGame): { scores: Tally; hp: Tally } {
  const scores: Tally = {}
  const hp: Tally = {}
  for (const p of players) {
    scores[p.id] = 0
    hp[p.id] = isBattle(game) && !p.left ? DUEL_HP : 0
  }
  return { scores, hp }
}

/**
 * Scores one question. Every right answer scores 1, the fastest one 1 more. In a battle each right answer,
 * fastest first, also hits the healthiest other player still standing (the fastest x1.5); a player knocked
 * out earlier in the same question no longer hits.
 */
export function scoreRound(
  game: DuelGame,
  players: PartyPlayer[],
  scores: Tally,
  hp: Tally,
  q: Pick<PartyQuestion, 'n' | 'damage'>,
  answers: Record<number, PartyAnswer>,
): { result: PartyResult; scores: Tally; hp: Tally } {
  const standing = new Set(standingPlayers(players, game, hp).map((p) => p.id))
  const right = Object.entries(answers)
    .filter(([id, a]) => a.ok && standing.has(Number(id)))
    .sort((a, b) => a[1].ms - b[1].ms)
    .map(([id]) => Number(id))
  const nextScores = { ...scores }
  const nextHp = { ...hp }
  const hits: PartyHit[] = []
  right.forEach((id, i) => {
    nextScores[id] = (nextScores[id] ?? 0) + (i === 0 && !isBattle(game) ? 2 : 1)
    if (!isBattle(game) || nextHp[id] <= 0) return
    const ids = players.map((p) => p.id)
    const t = hitTarget(
      players.map((p) => (p.left ? 0 : nextHp[p.id])),
      ids.indexOf(id),
    )
    if (t < 0) return
    const damage = i === 0 ? Math.round(q.damage * FASTEST_BONUS) : q.damage
    nextHp[ids[t]] = Math.max(0, nextHp[ids[t]] - damage)
    hits.push({ from: id, to: ids[t], damage })
  })
  return { result: { n: q.n, right, hits }, scores: nextScores, hp: nextHp }
}

/** The winner: the last player standing (also when everyone else left), or the first to the target score. */
export function partyWinner(game: DuelGame, players: PartyPlayer[], scores: Tally, hp: Tally): number | null {
  const standing = standingPlayers(players, game, hp)
  if (standing.length === 1) return standing[0].id
  if (isBattle(game) || standing.length === 0) return null
  const best = standing.reduce((a, b) => ((scores[b.id] ?? 0) > (scores[a.id] ?? 0) ? b : a))
  return (scores[best.id] ?? 0) >= PARTY_TARGET ? best.id : null
}

export type HostPhase = 'lobby' | 'question' | 'result' | 'end'

export interface HostState {
  phase: HostPhase
  game: DuelGame
  players: PartyPlayer[]
  scores: Tally
  hp: Tally
  q: PartyQuestion | null
  answers: Record<number, PartyAnswer>
  result: PartyResult | null
  winner: number | null
}

export type HostAction =
  | { type: 'join'; id: number; name: string }
  | { type: 'leave'; id: number }
  | { type: 'game'; game: DuelGame }
  | { type: 'start' }
  | { type: 'ask'; q: PartyQuestion }
  | { type: 'answer'; id: number; n: number; ok: boolean; ms: number }
  | { type: 'close' }
  | { type: 'finish' }
  | { type: 'lobby' }

export const newHost = (hostName: string): HostState => ({
  phase: 'lobby',
  game: 'choice',
  players: [{ id: 0, name: hostName.trim().slice(0, 16) || 'Host' }],
  scores: {},
  hp: {},
  q: null,
  answers: {},
  result: null,
  winner: null,
})

/** Ends the open question: scores it and decides whether someone has won. */
function close(s: HostState): HostState {
  if (s.phase !== 'question' || !s.q) return s
  const { result, scores, hp } = scoreRound(s.game, s.players, s.scores, s.hp, s.q, s.answers)
  return { ...s, phase: 'result', result, scores, hp, winner: partyWinner(s.game, s.players, scores, hp) }
}

export function hostReducer(s: HostState, a: HostAction): HostState {
  switch (a.type) {
    case 'join': {
      if (s.phase !== 'lobby') return s
      const players = joinPlayer(s.players, a.id, a.name)
      return players ? { ...s, players } : s
    }
    case 'leave': {
      const players = s.phase === 'lobby' ? s.players.filter((p) => p.id !== a.id) : s.players.map((p) => (p.id === a.id ? { ...p, left: true } : p))
      const next = { ...s, players }
      if (s.phase === 'lobby') return next
      // The one left standing wins straight away; otherwise the question may now be complete.
      if (standingPlayers(players, s.game, s.hp).length <= 1) {
        return { ...next, phase: 'end', winner: partyWinner(s.game, players, s.scores, s.hp) }
      }
      return s.phase === 'question' && allAnswered(next) ? close(next) : next
    }
    case 'game':
      return s.phase === 'lobby' ? { ...s, game: a.game } : s
    case 'start':
      return activePlayers(s.players).length >= 2 ? { ...s, ...freshTally(s.players, s.game), winner: null, result: null } : s
    case 'ask':
      return { ...s, phase: 'question', q: a.q, answers: {}, result: null }
    case 'answer': {
      if (s.phase !== 'question' || a.n !== s.q?.n || s.answers[a.id]) return s
      if (!standingPlayers(s.players, s.game, s.hp).some((p) => p.id === a.id)) return s
      const next = { ...s, answers: { ...s.answers, [a.id]: { ok: a.ok, ms: a.ms } } }
      return allAnswered(next) ? close(next) : next
    }
    case 'close':
      return close(s)
    case 'finish':
      return { ...s, phase: 'end' }
    case 'lobby':
      return { ...s, phase: 'lobby', players: activePlayers(s.players), q: null, answers: {}, result: null, winner: null }
  }
}

function allAnswered(s: HostState): boolean {
  return standingPlayers(s.players, s.game, s.hp).every((p) => s.answers[p.id])
}
