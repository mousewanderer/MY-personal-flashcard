const PATHS = {
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-3.5-3.5',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  import: 'M12 15V3M7 10l5 5 5-5M4 20h16',
  export: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  sets: 'M3 9h18v11H3zM6 6h12M9 3h6',
  flashcards: 'M4 5h16v14H4zM8 10h8M8 14h5',
  choice: 'M4 4h16v16H4zM8 12l3 3 5-6',
  writing: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  matchlist: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  scramble: 'M5 20l7-16 7 16M8 14h8',
  hangman: 'M4 21h8M6 21V3h9v3M15 12a3 3 0 1 0 0-6a3 3 0 1 0 0 6zM15 12v5M12 21l3-4 3 4',
  wheel: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7h.01M17 12h.01M12 17h.01M7 12h.01',
  timer: 'M12 5a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM12 9v4l3 2M10 2h4',
  bulk: 'M4 6h16M4 10h16M4 14h10M4 18h7M17 15v6M14 18h6',
  profile: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM4 20c1.5-4 4.5-6 8-6s6.5 2 8 6',
  flame: 'M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5.2.2 1.9 1 3 2.2 3.4-.7-2.8-.4-5.6.3-8.7z',
  trophy: 'M8 4h8v6a4 4 0 0 1-8 0V4zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 14v4M8 21h8M10 18h4',
  target: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 12h.01',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  compass: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, filled = false, size = 20 }: { name: IconName; filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
