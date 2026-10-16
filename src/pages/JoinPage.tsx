import { useEffect, useState } from 'react'
import { getValue, setValue } from '../db/repo'
import { DUEL_GAMES, type DuelGame } from '../lib/duel'
import { helloMsg, parseHostMsg, type PartyPlayer, type PartyQuestion, type PartyResult, type Tally } from '../lib/party'
import { PartyEnd, PartyPlay } from '../party/PartyPlay'
import { cleanAddress, closeLan, Lan, lanAvailable, onLan, sendTo } from '../platform/lan'
import { navigate } from '../router'
import type { ProfileSettings } from '../types'

interface Game {
  me: number
  game: DuelGame
  players: PartyPlayer[]
  scores: Tally
  hp: Tally
  q: PartyQuestion | null
  result: PartyResult | null
  end: { winner: number | null } | null
}

/** A guest's side of a hotspot game: connect to the host's address, then play what it sends. */
export default function JoinPage() {
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [stage, setStage] = useState<'form' | 'connecting' | 'in'>('form')
  const [error, setError] = useState('')
  const [g, setG] = useState<Game | null>(null)

  useEffect(() => {
    void getValue<string>('lanHost').then((a) => a && setAddress(a))
    void getValue<ProfileSettings>('profile').then((p) => p?.name && setName(p.name))
  }, [])

  useEffect(() => {
    const drop = (message: string) => {
      setError(message)
      setStage('form')
      setG(null)
      closeLan()
    }
    const off = onLan(
      (id, joined) => {
        if (id === 0 && !joined) drop('The host closed the game.')
      },
      (from, data) => {
        const m = from === 0 ? parseHostMsg(data) : null
        if (!m) return
        if (m.t === 'full') drop('That game is full or has already started.')
        else if (m.t === 'bye') drop('The host closed the game.')
        else if (m.t === 'lobby') setG({ me: m.you, game: m.game, players: m.players, scores: {}, hp: {}, q: null, result: null, end: null })
        else if (m.t === 'question') setG((x) => x && { ...x, game: m.game, players: m.players, scores: m.scores, hp: m.hp, q: m.q, result: null, end: null })
        else if (m.t === 'result') setG((x) => x && { ...x, scores: m.scores, hp: m.hp, result: m.r })
        else if (m.t === 'end') setG((x) => x && { ...x, players: m.players, scores: m.scores, hp: m.hp, end: { winner: m.winner } })
      },
    )
    return () => {
      off()
      closeLan()
    }
  }, [])

  async function join() {
    const host = cleanAddress(address)
    if (!host) return
    setError('')
    setStage('connecting')
    void setValue('lanHost', host)
    try {
      await Lan.join({ address: host })
      sendTo(0, helloMsg(name))
      setStage('in')
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't reach ${host}.`)
      setStage('form')
    }
  }

  function leave() {
    closeLan()
    setG(null)
    setStage('form')
  }

  if (!lanAvailable) {
    return (
      <div className="page">
        <h1>Join game</h1>
        <p className="muted">Hotspot games need the Android app on every phone.</p>
      </div>
    )
  }

  if (stage === 'in' && g?.end) {
    return (
      <PartyEnd me={g.me} game={g.game} winner={g.end.winner} players={g.players} scores={g.scores} hp={g.hp}>
        <span className="muted small">Waiting for the host to start another round.</span>
        <button type="button" className="btn" onClick={leave}>
          Leave
        </button>
      </PartyEnd>
    )
  }

  if (stage === 'in' && g?.q) {
    const n = g.q.n
    return (
      <PartyPlay
        me={g.me}
        game={g.game}
        players={g.players}
        scores={g.scores}
        hp={g.hp}
        q={g.q}
        result={g.result}
        onAnswer={(ok, ms) => sendTo(0, { t: 'answer', n, ok, ms })}
      />
    )
  }

  if (stage === 'in') {
    return (
      <div className="page party-lobby">
        <h1>Joined</h1>
        {g ? (
          <>
            <p>
              Game: <strong>{DUEL_GAMES.find((x) => x.id === g.game)?.name}</strong>. Waiting for the host to start.
            </p>
            <ul className="party-players">
              {g.players.map((p) => (
                <li key={p.id}>
                  {p.name}
                  {p.id === g.me ? ' (you)' : p.id === 0 ? ' (host)' : ''}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Connected. Waiting for the host…</p>
        )}
        <button type="button" className="btn" onClick={leave}>
          Leave
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Join game</h1>
      <p className="muted">Connect this phone to the host's hotspot, then enter the address shown on the host's screen.</p>
      <form
        className="party-join"
        onSubmit={(e) => {
          e.preventDefault()
          void join()
        }}
      >
        <label className="field">
          Host address
          <input className="input input-lg" value={address} onChange={(e) => setAddress(e.target.value)} inputMode="decimal" placeholder="192.168.43.1" required />
        </label>
        <label className="field">
          Your name
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="Player" />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="row wrap">
          <button type="submit" className="btn btn-primary" disabled={stage === 'connecting'}>
            {stage === 'connecting' ? 'Connecting…' : 'Join'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
