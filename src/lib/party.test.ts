import { describe, expect, it } from 'vitest'
import { DUEL_HP } from './duel'
import {
  hostReducer,
  joinPlayer,
  newHost,
  parseGuestMsg,
  parseHostMsg,
  partyWinner,
  PARTY_TARGET,
  scoreRound,
  type HostState,
  type PartyPlayer,
  type PartyQuestion,
} from './party'

const players: PartyPlayer[] = [
  { id: 0, name: 'Ana' },
  { id: 1, name: 'Ben' },
  { id: 2, name: 'Cy' },
]
const q: PartyQuestion = { n: 1, prompt: 'cat', answer: 'gato', ms: 15000, damage: 10 }

describe('party messages', () => {
  it('accepts well-formed guest messages and rejects anything else', () => {
    expect(parseGuestMsg('{"t":"hello","v":1,"name":"Ben"}')).toEqual({ t: 'hello', v: 1, name: 'Ben' })
    expect(parseGuestMsg('{"t":"answer","n":3,"ok":true,"ms":1200}')).toEqual({ t: 'answer', n: 3, ok: true, ms: 1200 })
    expect(parseGuestMsg('{"t":"hello","v":2,"name":"Ben"}')).toBeNull()
    expect(parseGuestMsg('{"t":"answer","n":"3"}')).toBeNull()
    expect(parseGuestMsg('not json')).toBeNull()
    expect(parseHostMsg('{"t":"bye"}')).toEqual({ t: 'bye' })
    expect(parseHostMsg('{"t":"hack"}')).toBeNull()
  })
})

describe('party lobby', () => {
  it('takes at most 4 players and keeps names unique', () => {
    let list: PartyPlayer[] | null = [{ id: 0, name: 'Ana' }]
    list = joinPlayer(list, 1, ' ana ')!
    expect(list[1].name).toBe('ana 2')
    list = joinPlayer(joinPlayer(list, 2, '')!, 3, 'Dee')!
    expect(list.map((p) => p.name)).toEqual(['Ana', 'ana 2', 'Player 3', 'Dee'])
    expect(joinPlayer(list, 4, 'Eve')).toBeNull()
  })
  it('drops a player who leaves the lobby, and needs two players to start', () => {
    let s = hostReducer(newHost('Ana'), { type: 'join', id: 1, name: 'Ben' })
    s = hostReducer(s, { type: 'leave', id: 1 })
    expect(s.players).toHaveLength(1)
    expect(hostReducer(s, { type: 'start' })).toBe(s)
  })
})

describe('party scoring', () => {
  it('gives every right answer a point and the fastest one an extra point', () => {
    const r = scoreRound('choice', players, { 0: 0, 1: 0, 2: 0 }, {}, q, {
      0: { ok: true, ms: 900 },
      1: { ok: true, ms: 400 },
      2: { ok: false, ms: 300 },
    })
    expect(r.result.right).toEqual([1, 0])
    expect(r.scores).toEqual({ 0: 1, 1: 2, 2: 0 })
  })
  it('in a battle hits the healthiest rival, the fastest one harder', () => {
    const hp = { 0: DUEL_HP, 1: 30, 2: 50 }
    const r = scoreRound('battle', players, { 0: 0, 1: 0, 2: 0 }, hp, q, { 1: { ok: true, ms: 400 }, 0: { ok: true, ms: 900 } })
    expect(r.result.hits).toEqual([
      { from: 1, to: 0, damage: 15 },
      { from: 0, to: 2, damage: 10 },
    ])
    expect(r.hp).toEqual({ 0: DUEL_HP - 15, 1: 30, 2: 40 })
  })
  it('finds the winner at the target or when one player is left standing', () => {
    expect(partyWinner('choice', players, { 0: PARTY_TARGET, 1: 3, 2: 0 }, {})).toBe(0)
    expect(partyWinner('choice', players, { 0: 9, 1: 3, 2: 0 }, {})).toBeNull()
    expect(partyWinner('battle', players, {}, { 0: 0, 1: 12, 2: 0 })).toBe(1)
    const gone = players.map((p) => (p.id === 0 ? p : { ...p, left: true }))
    expect(partyWinner('choice', gone, { 0: 1 }, {})).toBe(0)
  })
})

describe('party host', () => {
  function playing(): HostState {
    let s = newHost('Ana')
    s = hostReducer(s, { type: 'join', id: 1, name: 'Ben' })
    s = hostReducer(s, { type: 'join', id: 2, name: 'Cy' })
    s = hostReducer(s, { type: 'start' })
    return hostReducer(s, { type: 'ask', q })
  }
  it('closes the question once everyone has answered', () => {
    let s = playing()
    s = hostReducer(s, { type: 'answer', id: 0, n: 1, ok: true, ms: 500 })
    s = hostReducer(s, { type: 'answer', id: 1, n: 1, ok: false, ms: 700 })
    expect(s.phase).toBe('question')
    s = hostReducer(s, { type: 'answer', id: 1, n: 1, ok: true, ms: 800 }) // a second answer is ignored
    s = hostReducer(s, { type: 'answer', id: 2, n: 0, ok: true, ms: 100 }) // a stale question is ignored
    expect(s.phase).toBe('question')
    s = hostReducer(s, { type: 'answer', id: 2, n: 1, ok: true, ms: 900 })
    expect(s.phase).toBe('result')
    expect(s.scores).toEqual({ 0: 2, 1: 0, 2: 1 })
  })
  it('stops waiting for a player who drops, and ends when one is left', () => {
    let s = hostReducer(playing(), { type: 'answer', id: 0, n: 1, ok: true, ms: 500 })
    s = hostReducer(s, { type: 'answer', id: 1, n: 1, ok: true, ms: 600 })
    s = hostReducer(s, { type: 'leave', id: 2 })
    expect(s.phase).toBe('result')
    s = hostReducer(s, { type: 'leave', id: 1 })
    expect(s).toMatchObject({ phase: 'end', winner: 0 })
  })
})
