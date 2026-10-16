// What to celebrate after an answer: a new level, newly unlocked achievements, the daily goal, and
// colours or themes that the new level unlocks. What has been celebrated is kept in `kv` (`celebrated`).

export interface Seen {
  level: number
  achievements: string[]
  /** The day ('YYYY-MM-DD') the daily goal was last celebrated. */
  goalDay: string | null
}

export interface Unlockable {
  name: string
  level: number
  what: 'accent colour' | 'theme'
}

export type Celebration =
  | { kind: 'level'; level: number; rank: string }
  | { kind: 'achievement'; name: string; description: string }
  | { kind: 'goal'; goal: number }
  | { kind: 'unlock'; name: string; what: Unlockable['what'] }

export interface CelebrateInput {
  level: number
  rank: string
  achievements: { id: string; name: string; description: string; unlocked: boolean }[]
  /** Answers today and the daily goal. */
  today: number
  goal: number
  day: string
}

/**
 * Compares the profile with what was already celebrated. The first time there is nothing to compare
 * with, so it records the current state quietly: updating the app doesn't replay old milestones.
 */
export function newCelebrations(seen: Seen | undefined, p: CelebrateInput, unlocks: Unlockable[]): { events: Celebration[]; seen: Seen } {
  const unlocked = p.achievements.filter((a) => a.unlocked)
  const goalMet = p.today >= Math.max(1, p.goal)
  if (!seen) {
    return { events: [], seen: { level: p.level, achievements: unlocked.map((a) => a.id), goalDay: goalMet ? p.day : null } }
  }
  const events: Celebration[] = []
  if (p.level > seen.level) {
    events.push({ kind: 'level', level: p.level, rank: p.rank })
    for (const u of unlocks) if (u.level > seen.level && u.level <= p.level) events.push({ kind: 'unlock', name: u.name, what: u.what })
  }
  const known = new Set(seen.achievements)
  for (const a of unlocked) if (!known.has(a.id)) events.push({ kind: 'achievement', name: a.name, description: a.description })
  const goalNow = goalMet && seen.goalDay !== p.day
  if (goalNow) events.push({ kind: 'goal', goal: p.goal })
  return {
    events,
    seen: {
      // Levels and achievements only count up here, so a lost card can't trigger a repeat later.
      level: Math.max(seen.level, p.level),
      achievements: [...new Set([...seen.achievements, ...unlocked.map((a) => a.id)])],
      goalDay: goalNow ? p.day : seen.goalDay,
    },
  }
}
