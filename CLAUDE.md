# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

`flashcards-app-claude-code-prompt.md` is the full spec. It covers features, the data model, both CSV formats, the merge rules, the scheduler math, the test list and the build phases. Read the relevant section before implementing anything. This file only summarizes rules that cut across modules. When the code and this file disagree, check the spec and then update this file.

The project lives at `C:\dev\flashcards`. It was moved out of OneDrive to avoid file-lock problems with `node_modules` and Gradle.

## Current scope (basic version, overrides the spec's phase list)

The user asked for a basic version with the modes from their flashcards.world screenshots. The "Current scope" phases are:
1. Core web app: My Sets, the set editor, bulk paste, simple CSV (Format A) import and export, settings and themes, and the study modes Flashcards (smart scheduling), Multiple Choice, Writing and Match List.
2. Game modes: Word Scramble, Hangman, Letter Wheel and Time Attack. They follow the flashcards.world modes "Word Salad", "Alphabet Ring", "Hangman" and "Time Attack", renamed where the original name was distinctive.
3. Android: Capacitor, file export and share, the back button, safe areas, and a GitHub Actions debug APK build.

All three phases are done (one commit each). New work comes from the deferred list below, when the user asks for it, and still follows the planning procedure.

Deferred until the user asks: the sync file (Format B) with merge and undo, the PWA and GitHub Pages, text-to-speech and the audio mode, images, drawing, the custom quiz, the stats screen, and the "Brain Gym" tab.

Mode names and descriptions live in one registry (`src/modes/registry.ts`). Each mode is a component that takes `ModeProps` (`src/modes/types.ts`). The mode `id` is stored in the review log, so rename the `name` and never change the `id`.

## Planning procedure

Build in the phases under "Current scope". Follow these steps for every phase, and for any non-trivial change between phases:

1. **Read.** Re-read the spec sections the phase touches, plus "Ground rules". Look at what already exists so you can reuse it. Before Phase 1, check `node --version` and `git --version` and tell the user if anything needs installing.
2. **Plan, then wait.** Write a short plan (about one screen) in plan mode and get the user's OK before editing files. The plan covers:
   - Scope: which spec items this phase delivers and what is deferred.
   - Modules and files to add or change.
   - Data changes: new Dexie tables or indexes (with a schema version bump) and any effect on the CSV formats.
   - New dependencies, with any that are large, paid or need an account flagged for approval.
   - Tests to add (from the spec's "Tests" list) and how the user can try the result.
   - Risks, or places where the spec conflicts with Capacitor or browser behavior, and the proposed workaround.
3. **Build in small steps.** Run the affected tests (`npx vitest run <file>`) as you go.
4. **Close the phase.** Run the full test suite and a production build and fix any failures. Make a git commit with a clear message. Report in under 10 lines (what works, how to try it, what the user needs to install or decide). Then stop and wait for the user to say "continue".

## Working rules

- The user's token budget is limited. Keep plans, edits and reports short, and don't rewrite working files without a reason.
- Windows laptop. Give commands in PowerShell syntax (Windows PowerShell 5.1 has no `&&`) and say explicitly when something needs Git Bash instead.
- Ask before adding a paid service, anything that needs an account other than GitHub, or any large dependency. Confirm before the first push to GitHub, because the Pages repo will be public.
- If the spec conflicts with how Capacitor or the browser actually behaves, use whatever works and say so in the phase summary.
- This is an original app. It copies flashcards.world's feature set, never its name, logo, wording or assets. No emojis in the UI.

## Commands

```powershell
npm run dev                           # Vite dev server
npm run build                         # tsc -b, then vite build (type errors fail the build)
npm run preview                       # serve the production build locally
npm run lint                          # oxlint
npm test                              # all unit tests (vitest run; only src/**/*.test.ts)
npx vitest run src/path/x.test.ts     # a single test file
npx vitest run -t "name"              # tests whose name matches
npx cap sync android                  # copy the latest web build into the Android project (run after build)
cd android; .\gradlew.bat assembleDebug   # local debug APK (JDK 21 + Android command-line tools, no Android Studio)
.\scripts\desktop\launch.ps1 -Stop    # stop the desktop shortcut's background server (frees port 5173)
.\scripts\desktop\launch.ps1 -Install # recreate the "Flashcards" desktop shortcut
```

Dev and preview are pinned to port 5173 (`strictPort`) because IndexedDB is per origin: the user's data lives in Edge at `http://localhost:5173`. The desktop shortcut runs `scripts/desktop/launch.ps1`, which rebuilds when the source is newer than `dist/`, serves it with `vite preview` hidden in the background, and opens an Edge `--app` window. If `npm run dev` says the port is in use, stop that server first.

Debug APKs are signed with a fixed key (`android/app/debug-signing.p12`, git-ignored). CI rebuilds that file from the `DEBUG_KEYSTORE_BASE64` repo secret, so every update installs over the previous app and keeps its data. Never commit the key: the repo is public.

The main way to get an APK is `.github/workflows/android.yml`. On every push to main it runs `npm test`, builds, syncs and uploads `flashcards-debug-apk` as an artifact, so a failing test blocks the APK. It fails on purpose if the secret is missing. There is no Pages workflow yet (deferred). The local Gradle build is the fallback. The README holds the user-facing install and signing steps.

## Architecture

**Stack:** Vite + React + TypeScript (strict), Dexie over IndexedDB, PapaParse, Capacitor 8 (Android), Vitest. vite-plugin-pwa comes in with the deferred PWA work. Styling is one global stylesheet (`src/styles/global.css`). There is no UI framework and no chart library (the 7-day chart is hand-written SVG). Keep dependencies few.

**One build, two shells.** The same web build runs in the browser (and later on GitHub Pages) and inside Capacitor as the Android app. That works because Vite uses `base: './'` and routing uses the URL hash (`src/router.ts`: `useRoute`, `navigate`), so there is no router library and no need for a path-specific base. Code that differs by platform lives in `src/platform/`:
- Text-to-speech (deferred, not built yet): `speak(text, lang)` uses the Web Speech API on web and `@capacitor-community/text-to-speech` on Android, because speechSynthesis in the Android WebView is unreliable. If a language has no voice, it falls back to the default voice and shows a notice once.
- Export (`platform/files.ts`): a browser download on web. On Android it writes the file to the cache directory with `@capacitor/filesystem`, then opens the `@capacitor/share` sheet, with "Save to Documents" as a second option.
- Import: `<input type="file">` on both platforms, accepting MIME types broadly and validating by content.
- Back button (`platform/backButton.ts`, `@capacitor/app`): a screen registers its handler with `setBackHandler`.
- Safe areas: Capacitor's SystemBars plugin (`capacitor.config.ts`, `insetsHandling: 'css'`) injects `--safe-area-inset-*`. `global.css` maps these to `--sat`/`--sar`/... and falls back to `env()` in browsers.
- Device label ("laptop" on web, "phone" on Android): comes with the Format B sync work.

**Data (Dexie).** The schema is in `src/db/db.ts` (currently version 3). Tables: `sets`, `cards` (indexed by `setId`), `reviews` (one per card, keyed by `cardId`), `logs` (the review log, device-only, feeds stats), `kv` (settings and other small values) and `docs` (added in version 2). `docs` holds the plain text extracted from imported PDFs: the Docs tab, `src/lib/pdf.ts` plus the pure `pdfText.ts`, with pdf.js loaded lazily. Version 3 adds `tracks`, the imported songs stored as Blobs. Docs and tracks are device-only, never go into CSV, and are hard-deleted: they are the exceptions to the soft-delete rule. The music player lives in `src/music/player.ts`: one `<audio>` element outside the React tree, so playback survives route changes and study sessions. It exposes state through `useSyncExternalStore`, with the fast-changing playback time in a separate store so the whole page doesn't re-render several times a second. The queue logic is the pure `src/lib/queue.ts`. All reads and writes go through `src/db/repo.ts`. IDs are UUIDs. Deletes are soft: set `deleted = true` and bump `updatedAt` so deletions sync as tombstones. Every UI query must filter out deleted rows. Card images are device-only Blobs (resized to max 800 px JPEG) and never go into CSV. Call `navigator.storage.persist()` on first run. The Profile tab's XP, level, streaks and achievements are never stored. They are derived from the review log on each render (`src/lib/profile.ts`), so any change to what gets logged changes them too. The only stored part is the name, color and daily goal, in `kv` under `profile`. The app name lives in one config constant. The Android app id is `com.melyap.flashcards`.

**Scheduler.** An SM-2 variant written as pure functions in `src/lib/scheduler.ts` (spec: "Spaced repetition scheduler"). Pass in the current time and the random source for fuzz so it stays pure and testable. "Mastered" means the card is in review state with an interval of at least 21 days.

**How study modes update the schedule.** This is shared by all modes and is implemented in `shouldUpdateSchedule` (`src/lib/session.ts`) and `recordAnswer` (`src/db/repo.ts`):
- Flashcards always updates spaced repetition with Again, Hard, Good or Easy. It merges the spec's Review and Flashcards modes. The exception is "Practice all" (studying when nothing is due), which never changes the schedule.
- A card is "due" when it isn't new and its `due` falls on or before the end of today (`isDue`).
- Every other mode updates it only for cards that are currently due (correct = Good, wrong = Again), so practicing ahead doesn't inflate intervals.
- Every answer in every mode is written to the review log.
- Every mode supports direction (front→back, back→front, mixed), shuffle and starred-only, and ends with a summary that offers "study missed cards again".

**CSV is the sync.** There is no server, and the two devices never talk to each other directly.
- Format A (simple, compatible with flashcards.world): no header. Columns are front, back, then up to 3 wrong options. One set per file, card text only, no BOM on export.
- Format B (sync file, `format = fcsync-1`): the exact column order is in the spec. One row per card, and a set with no cards gets one row with empty card columns. Tombstones are included. Timestamps are ISO 8601 UTC and booleans are 0/1. It is exported with a BOM. On import it is detected by its `format` and `card_id` headers.
- Parsing: PapaParse as UTF-8, strip any BOM, handle quoted commas, doubled quotes and line breaks, and detect tab and semicolon separators.
- Merge (Format B): match by id and add unknown ids. For content fields, the later `updated_at` wins. For review-state fields, the later `last_reviewed_at` wins, decided separately from content. The local image is always kept.
- Import is all-or-nothing, in this order: parse → validate the whole file (reject it with the row numbers of any bad rows) → preview the counts (new / updated / deleted / unchanged) → user confirms → snapshot the database (keep the last 3) → apply → offer "Undo last import".

Keep CSV parsing and serialization, merge, the scheduler and the writing-answer checker in pure modules, separate from Dexie and React. Those are the surfaces the spec's Vitest suite covers. They live in `src/lib/` with a `*.test.ts` file beside each one: `csv`, `scheduler`, `answer` (the writing checker), `session`, `choices`, `bulkPaste` and `games`. Randomness goes through the `Rng` type (`src/lib/random.ts`) so tests can pass a seeded source.
