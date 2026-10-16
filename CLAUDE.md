# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

`flashcards-app-claude-code-prompt.md` is the full spec. It covers features, the data model, both CSV formats, the merge rules, the scheduler math, the test list and the build phases. Read the relevant section before implementing anything. This file only summarizes rules that cut across modules. When the code and this file disagree, check the spec and then update this file.

The project lives at `C:\dev\flashcards`, outside OneDrive, to avoid file locks on `node_modules` and Gradle.

## Scope

The basic version (the user's flashcards.world modes, built as phases 1-3: web app, game modes, Android) is done and replaces the spec's phase list. The app has grown well past it since. New work happens only when the user asks for it.

Deferred until the user asks: the sync file (Format B) with merge and undo, the PWA and GitHub Pages, text-to-speech and the audio mode, card images, drawing, the custom quiz, the stats screen, and the "Brain Gym" tab. Their design is in the spec. "Deferred work" at the end of this file holds the notes that exist only here.

Mode names and descriptions live in one registry (`src/modes/registry.ts`). Each mode is a component that takes `ModeProps` (`src/modes/types.ts`). The mode `id` is stored in the review log, so rename the `name` and never change the `id`. The multiple-choice and typed question screens are shared components in `src/modes/questions.tsx` (used by Multiple Choice, Writing and Learn).

## Workflow

For every feature or non-trivial change:

1. **Read.** The spec sections it touches, plus "Ground rules", and the existing code you can reuse.
2. **Plan, then wait.** Write a short plan (about one screen) in plan mode and get the user's OK before editing files. The plan covers:
   - Scope: which spec items it delivers and what is deferred.
   - Modules and files to add or change.
   - Data changes: new Dexie tables or indexes (with a schema version bump) and any effect on the CSV formats.
   - New dependencies.
   - Tests to add (from the spec's "Tests" list) and how the user can try the result.
   - Risks, including places where the spec conflicts with Capacitor or browser behavior. Use whatever actually works and say so in the report.
3. **Build in small steps.** Run the affected tests (`npx vitest run <file>`) as you go.
4. **Final check (always last).** Run the full test suite and a production build and fix any failures. Make a git commit with a clear message. Report in under 10 lines (what works, how to try it, what the user needs to install or decide). Then stop and wait for the user to say "continue".

## Working rules

- The user's token budget is limited. Keep plans, edits and reports short, and don't rewrite working files without a reason.
- Windows laptop. Give commands in PowerShell syntax (Windows PowerShell 5.1 has no `&&`) and say explicitly when something needs Git Bash instead.
- Ask before adding a paid service, anything that needs an account other than GitHub, or any large dependency.
- This is an original app. It copies flashcards.world's feature set, never its name, logo, wording or assets, and renames modes whose original name is distinctive (Word Salad is Word Scramble, Alphabet Ring is Letter Wheel). No emojis in the UI.

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
.\scripts\desktop\launch.ps1 -Install # recreate the "Knowetility" desktop shortcut
```

Dev and preview are pinned to port 5173 (`strictPort`) because IndexedDB is per origin: the user's data lives in Edge at `http://localhost:5173`. The desktop shortcut runs `scripts/desktop/launch.ps1`, which rebuilds when the source is newer than `dist/`, serves it with `vite preview` hidden in the background, and opens an Edge `--app` window. If `npm run dev` says the port is in use, stop that server first.

Debug APKs are signed with a fixed key (`android/app/debug-signing.p12`, git-ignored). CI rebuilds that file from the `DEBUG_KEYSTORE_BASE64` repo secret, so every update installs over the previous app and keeps its data. Never commit the key: the repo is public.

The main way to get an APK is `.github/workflows/android.yml`. On every push to main it runs `npm test`, builds, syncs and uploads `flashcards-debug-apk` as an artifact, so a failing test blocks the APK. It fails on purpose if the secret is missing. The local Gradle build is the fallback. The README holds the user-facing install and signing steps.

## Architecture

**Stack:** Vite + React + TypeScript (strict), Dexie over IndexedDB, PapaParse, Capacitor 8 (Android, with `@capacitor/local-notifications`), ts-fsrs (the optional FSRS scheduler), Vitest. Styling is one global stylesheet (`src/styles/global.css`). There is no UI framework and no chart library (the 7-day chart is hand-written SVG). Keep dependencies few.

**One build, two shells.** The same web build runs in the browser (and later on GitHub Pages) and inside Capacitor as the Android app. That works because Vite uses `base: './'` and routing uses the URL hash (`src/router.ts`: `useRoute`, `navigate`), so there is no router library and no need for a path-specific base. Code that differs by platform lives in `src/platform/`:
- Export (`platform/files.ts`): a browser download on web. On Android it writes the file to the cache directory with `@capacitor/filesystem`, then opens the `@capacitor/share` sheet, with "Save to Documents" as a second option.
- Import: `<input type="file">` on both platforms, accepting MIME types broadly and validating by content.
- Back button (`platform/backButton.ts`, `@capacitor/app`): a screen registers its handler with `setBackHandler`.
- Safe areas: Capacitor's SystemBars plugin (`capacitor.config.ts`, `insetsHandling: 'css'`) injects `--safe-area-inset-*`. `global.css` maps these to `--sat`/`--sar`/... and falls back to `env()` in browsers.
- Hotspot games (`platform/lan.ts` → the app's own `LanPlugin.java`, registered in `MainActivity`): plain TCP with newline-delimited JSON on port 8737, Android only, with no extra library. Plain sockets sidestep the WebView's ws:// limits on the https origin. The host phone is player 0 and runs the game (`hostReducer` in the pure `src/lib/party.ts`). Guests join from `#/join` (the My Sets "Join game" button) and only render what the host sends (`src/party/`). The app can't be built here (no JDK), so CI is the first compile of Java changes.
- Notifications (`platform/notify.ts`, `@capacitor/local-notifications`): the daily study reminder (Settings, stored in `kv` under `reminder`) and the focus timer's phase-end alarm, which is scheduled only while the app is in the background (`appStateChange`). Every call is a no-op on the web. The small icon is `android/app/src/main/res/drawable/ic_stat_notify.xml`, set in `capacitor.config.ts`.

**Data (Dexie).** The schema is in `src/db/db.ts`. Tables: `sets`, `cards` (indexed by `setId`), `reviews` (one per card, keyed by `cardId`), `logs` (the review log, device-only, feeds stats), `kv` (settings and other small values), `docs` and `tracks`. `docs` holds the plain text extracted from imported PDFs and photos: the Docs tab, `src/lib/pdf.ts` plus the pure `pdfText.ts`, with pdf.js loaded lazily. Pages without a text layer (`needsOcr`) and photos go through Tesseract.js OCR (`src/lib/ocr.ts`, lazy). Its worker and SIMD core ship with the build as `?url` assets with absolute URLs, because the worker runs from a blob. Language data downloads from jsdelivr on first use and is cached. The scan language is in `kv` under `ocrLang`. `tracks` holds the imported songs as Blobs. Docs and tracks are device-only, never go into CSV, and are hard-deleted: they are the exceptions to the soft-delete rule. The music player lives in `src/music/player.ts`: one `<audio>` element outside the React tree, so playback survives route changes and study sessions. It exposes state through `useSyncExternalStore`, with the fast-changing playback time in a separate store so the whole page doesn't re-render several times a second. The queue logic is the pure `src/lib/queue.ts`. All reads and writes go through `src/db/repo.ts`. IDs are UUIDs. Deletes are soft: set `deleted = true` and bump `updatedAt` so deletions sync as tombstones. Every UI query must filter out deleted rows. Call `navigator.storage.persist()` on first run. The Profile tab's XP, level, streaks and achievements are never stored. They are derived from the review log on each render (`src/lib/profile.ts`), so any change to what gets logged changes them too. The only stored part is the name, color and daily goal, in `kv` under `profile`. The app is called Knowetility ("Everything you study, in one box."). The name and tagline live in `src/config.ts` (`APP_NAME`, `APP_TAGLINE`). The Android app id stays `com.melyap.flashcards`, and the IndexedDB name stays too, so updates keep the user's data. The theme's brand gradient is `--grad`, from `--accent` (blue) to `--accent-2` (green). Every icon (Android launcher and splash, `public/favicon.png`, `scripts/desktop/knowetility.ico`) is generated from `assets/icon.png` by `scripts/make-icons.ps1`. Pass `-Source <file>` to use new artwork.

**Study helpers.**
- **Fill-in-the-blank cards:** a front containing `{{...}}` is a blank card (`src/lib/cloze.ts`). `makeItem` turns it into the sentence with `___` plus the hidden words as the answer, whatever the direction. The card editor, bulk paste and CSV import all store the hidden words as the back, so Format A round-trips.
- **Tags and exam dates:** sets have optional `tags` and `examDate` ('YYYY-MM-DD'), not indexed, so no schema bump. Until an exam, `recordAnswer` caps new review intervals at half the days left (`capForExam`, `src/lib/exam.ts`), whichever scheduler is on.
- **Cards from Docs:** selecting text on a doc page opens `DocCardDialog`; `src/lib/docCards.ts` finds the sentence and builds a fill-in-the-blank front.
- **Unlockable accents:** `Settings.accent` picks a colour from `src/lib/unlocks.ts`; it is applied as `data-accent` on `<html>` only once its Profile level is reached (`AccentColor` in `App.tsx`).
- **Word Scramble board:** `ScrambleBoard` (shared by Word Scramble and the Boss) stores one tile index per slot (`Placed`, `null` = empty), so a placed letter can be tapped back out.
- **Boss Battle:** the enemy list in `src/lib/boss.ts` (`ENEMIES`) sets the question type, hearts, health, timer and combos per level. Missed cards come back 3 cards later (`nextQueue`). Best times are in `kv` under `best:boss:<setId>:<level>`.
- **Duel:** pick Multiple Choice, Scramble, Battle or Scramble Battle first. The rules (`src/lib/duel.ts`) work for 2 to 4 players. The two-sided screen fits the viewport with no scrolling: each half is a CSS size container and scales its text with `cqmin`.
- **Word Search and Crossword:** `src/lib/wordgrid.ts` turns answers into grid words (`gridWord`) and builds both puzzles; words that do not fit roll into the next puzzle.
- **Study all sets:** `StudyPage` with the set id `all` (`ALL_SETS`) and an optional `?tag=` studies every set, or one tag.
- **Daily challenge:** `#/daily` logs with mode `daily`. Today's picks (a date-seeded order), done, score and streak are all derived from the log (`src/lib/daily.ts`); nothing is stored.
- **Focus timer:** `src/focus/timer.ts` is a module store like the music player. It stores `endsAt`, so the time is correct after the device sleeps. Its settings live in `kv` under `focus`.

**Scheduler.** An SM-2 variant written as pure functions in `src/lib/scheduler.ts` (spec: "Spaced repetition scheduler"). It stays the default. `Settings.scheduler = 'fsrs'` switches to FSRS via `src/lib/fsrs.ts` (`scheduleWith` and `previewWith` pick one), with the same learning steps and 90% retention. FSRS memory lives in the optional `ReviewState.stability`/`difficulty`; cards without it start from `fromClassic`. Pass in the current time and the random source for fuzz so it stays pure and testable. "Mastered" means the card is in review state with an interval of at least 21 days.

**How study modes update the schedule.** This is shared by all modes and is implemented in `shouldUpdateSchedule` (`src/lib/session.ts`) and `recordAnswer` (`src/db/repo.ts`):
- Flashcards always updates spaced repetition with Again, Hard, Good or Easy. It merges the spec's Review and Flashcards modes. The exception is "Practice all" (studying when nothing is due), which never changes the schedule.
- A card is "due" when it isn't new and its `due` falls on or before the end of today (`isDue`).
- Every other mode updates it only for cards that are currently due (correct = Good, wrong = Again), so practicing ahead doesn't inflate intervals.
- Every answer in every mode is written to the review log, with two exceptions. Duel (`logged: false` in the registry) logs nothing, because two people are answering, and it is left out of the Explorer badge. Memory logs the pairs it finds but never reschedules (`NEVER_RESCHEDULE` in `session.ts`), because it tests tile positions rather than recall.
- Every mode supports direction (front→back, back→front, mixed), shuffle and starred-only, and ends with a summary that offers "study missed cards again".

**CSV is the sync.** There is no server, and the two devices never talk to each other directly.
- Format A (simple, compatible with flashcards.world): no header. Columns are front, back, then up to 3 wrong options. One set per file, card text only, no BOM on export.
- Parsing: PapaParse as UTF-8, strip any BOM, handle quoted commas, doubled quotes and line breaks, and detect tab and semicolon separators.
- Import is all-or-nothing: validate the whole file first and reject it with the row numbers of any bad rows.

Keep CSV parsing and serialization, merge, the scheduler and the writing-answer checker (`answer`) in pure modules, separate from Dexie and React. Those are the surfaces the spec's Vitest suite covers. They live in `src/lib/` with a `*.test.ts` file beside each one. Randomness goes through the `Rng` type (`src/lib/random.ts`) so tests can pass a seeded source.

## Deferred work

The spec has the design: "Format B" (merge rules, import preview, snapshot and undo), "Sync screen", "Text-to-speech", "Settings" (device label) and "Data model" (card images). Notes that exist only here:
- Format B needs columns the spec doesn't list: set `tags` and `exam_date`, and review `stability` and `difficulty`.
- Text-to-speech goes in `src/platform/` as `speak(text, lang)`.
- The PWA uses vite-plugin-pwa.
