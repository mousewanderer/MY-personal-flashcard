import { useEffect, useReducer, useRef, useState } from 'react'
import { getValue } from '../db/repo'
import { itemChoices } from '../lib/choices'
import { DUEL_GAMES, duelDamage, duelScrambleable, usesScramble, type DuelGame } from '../lib/duel'
import { scrambleTiles } from '../lib/games'
import {
  activePlayers,
  canJoin,
  hostReducer,
  newHost,
  parseGuestMsg,
  PARTY_CHOICE_MS,
  PARTY_MAX,
  PARTY_RESULT_MS,
  PARTY_SCRAMBLE_MS,
  type PartyQuestion,
} from '../lib/party'
import { shuffle } from '../lib/random'
import type { StudyItem } from '../lib/session'
import { broadcast, closeLan, Lan, onLan, sendTo } from '../platform/lan'
import type { Card, ProfileSettings } from '../types'
import { PartyEnd, PartyPlay } from './PartyPlay'

const poolFor = (game: DuelGame, items: StudyItem[]) => (usesScramble(game) ? items.filter(duelScrambleable) : items)

function buildQuestion(n: number, item: StudyItem, game: DuelGame, allCards: Card[]): PartyQuestion {
  const base = { n, prompt: item.prompt, answer: item.answer, damage: duelDamage(game, item.answer) }
  if (usesScramble(game)) return { ...base, tiles: scrambleTiles(item.answer), ms: PARTY_SCRAMBLE_MS }
  const options = itemChoices(item, allCards, Math.random)
  return { ...base, options, correct: options.indexOf(item.answer.trim()), ms: PARTY_CHOICE_MS }
}

interface Props {
  items: StudyItem[]
  allCards: Card[]
  onExit: () => void
}

/** This phone hosts: it runs the game for up to three guests and plays as player 0. */
function HostGame({ name, items, allCards, onExit }: Props & { name: string }) {
  const [s, dispatch] = useReducer(hostReducer, name, newHost)
  const latest = useRef(s)
  useEffect(() => {
    latest.current = s
  })
  const [addresses, setAddresses] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const deck = useRef<StudyItem[]>([])
  const asked = useRef(0)

  const hostServer = () =>
    Lan.host()
      .then((r) => setAddresses(r.addresses))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't start the game."))

  function openServer() {
    setError('')
    void hostServer()
  }

  // The link: guests say hello to join and send their answers; a lost connection leaves the game.
  useEffect(() => {
    const off = onLan(
      (id, joined) => {
        if (!joined) dispatch({ type: 'leave', id })
      },
      (from, data) => {
        const m = parseGuestMsg(data)
        if (m?.t === 'hello') {
          if (latest.current.phase === 'lobby' && canJoin(latest.current.players)) dispatch({ type: 'join', id: from, name: m.name })
          else sendTo(from, { t: 'full' })
        } else if (m?.t === 'answer') dispatch({ type: 'answer', id: from, n: m.n, ok: m.ok, ms: m.ms })
      },
    )
    void hostServer()
    return () => {
      off()
      broadcast({ t: 'bye' })
      closeLan()
    }
  }, [])

  // Tell the guests what changed.
  useEffect(() => {
    if (s.phase !== 'lobby') return
    for (const p of activePlayers(s.players)) if (p.id !== 0) sendTo(p.id, { t: 'lobby', you: p.id, game: s.game, players: s.players })
  }, [s.phase, s.players, s.game])
  useEffect(() => {
    if (s.phase === 'question' && s.q) broadcast({ t: 'question', game: s.game, q: s.q, players: s.players, scores: s.scores, hp: s.hp })
  }, [s.phase, s.q, s.game, s.players, s.scores, s.hp])
  useEffect(() => {
    if (s.phase === 'result' && s.result) broadcast({ t: 'result', r: s.result, scores: s.scores, hp: s.hp })
  }, [s.phase, s.result, s.scores, s.hp])
  useEffect(() => {
    if (s.phase === 'end') broadcast({ t: 'end', winner: s.winner, players: s.players, scores: s.scores, hp: s.hp })
  }, [s.phase, s.winner, s.players, s.scores, s.hp])

  // Time's up closes the question (a little later than the guests' clocks, for the network).
  useEffect(() => {
    if (s.phase !== 'question' || !s.q) return
    const t = window.setTimeout(() => dispatch({ type: 'close' }), s.q.ms + 600)
    return () => window.clearTimeout(t)
  }, [s.phase, s.q])

  // After the result: the winner, or the next question.
  useEffect(() => {
    if (s.phase !== 'result') return
    const t = window.setTimeout(() => {
      if (s.winner !== null) {
        dispatch({ type: 'finish' })
        return
      }
      asked.current += 1
      const item = deck.current[(asked.current - 1) % deck.current.length]
      dispatch({ type: 'ask', q: buildQuestion(asked.current, item, s.game, allCards) })
    }, PARTY_RESULT_MS)
    return () => window.clearTimeout(t)
  }, [s.phase, s.winner, s.game, allCards])

  function start() {
    deck.current = shuffle(poolFor(s.game, items))
    asked.current = 1
    dispatch({ type: 'start' })
    dispatch({ type: 'ask', q: buildQuestion(1, deck.current[0], s.game, allCards) })
  }

  if (s.phase === 'end') {
    return (
      <PartyEnd me={0} game={s.game} winner={s.winner} players={s.players} scores={s.scores} hp={s.hp}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'lobby' })}>
          Play again
        </button>
        <button type="button" className="btn" onClick={onExit}>
          Close the game
        </button>
      </PartyEnd>
    )
  }

  if (s.phase !== 'lobby' && s.q) {
    return (
      <PartyPlay
        me={0}
        game={s.game}
        players={s.players}
        scores={s.scores}
        hp={s.hp}
        q={s.q}
        result={s.phase === 'result' ? s.result : null}
        onAnswer={(ok, ms) => s.q && dispatch({ type: 'answer', id: 0, n: s.q.n, ok, ms })}
      />
    )
  }

  const players = activePlayers(s.players)
  return (
    <div className="mode party-lobby">
      <h2 className="center">Hotspot game</h2>
      <ol className="small party-steps">
        <li>Turn on this phone's hotspot (or put every phone on the same Wi-Fi).</li>
        <li>On each other phone: connect to it, open the app, tap Join game on My Sets and enter this address:</li>
      </ol>
      {error ? (
        <div className="panel row-between" role="alert">
          <span className="error">{error}</span>
          <button type="button" className="btn" onClick={openServer}>
            Try again
          </button>
        </div>
      ) : addresses === null ? (
        <p className="muted center">Starting…</p>
      ) : addresses.length ? (
        <>
          <p className="party-address">{addresses[0]}</p>
          {addresses.length > 1 && <p className="muted small center">If that doesn't work, try: {addresses.slice(1).join(', ')}</p>}
        </>
      ) : (
        <div className="panel row-between" role="alert">
          <span>No network found. Turn on the hotspot, then check again.</span>
          <button type="button" className="btn" onClick={openServer}>
            Check again
          </button>
        </div>
      )}

      <div className="party-games" role="radiogroup" aria-label="Game">
        {DUEL_GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={s.game === g.id}
            className={`btn${s.game === g.id ? ' btn-primary' : ''}`}
            disabled={poolFor(g.id, items).length < 2}
            onClick={() => dispatch({ type: 'game', game: g.id })}
          >
            {g.name}
          </button>
        ))}
      </div>
      <p className="muted small center">Everyone answers every question. Right answers score; the fastest scores double (or hits 1.5x in a battle).</p>

      <ul className="party-players">
        {players.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.id === 0 ? ' (you, host)' : ''}
          </li>
        ))}
      </ul>
      <div className="row-center wrap">
        <button type="button" className="btn btn-primary" disabled={players.length < 2} onClick={start}>
          {players.length < 2 ? `Waiting for players (1 of ${PARTY_MAX})` : `Start with ${players.length} players`}
        </button>
        <button type="button" className="btn" onClick={onExit}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Loads the host's profile name, then hosts. */
export function PartyHost(props: Props) {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    void getValue<ProfileSettings>('profile').then((p) => setName(p?.name?.trim() || 'Host'))
  }, [])
  return name === null ? null : <HostGame {...props} name={name} />
}
