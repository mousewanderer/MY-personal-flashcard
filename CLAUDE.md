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

Deferred until the user asks: the sync file (Format B) with merge and undo, the PWA and GitHub Pages, text-to-speech and the audio mode, images, drawing, the custom quiz, the stats screen, and the "Brain Gym" tab.

Mode names and descriptions live in one registry (`src/modes/registry.ts`).

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

The spec requires these. Check the script names against `package.json` once the project is scaffolded.

```powershell
npm run dev                           # Vite dev server
npm run build                         # production build
npm run preview                       # serve the production build locally
npm run lint                          # oxlint
npm test                              # all unit tests (vitest run)
npx vitest run src/path/x.test.ts     # a single test file
npx vitest run -t "name"              # tests whose name matches
npx cap sync android                  # copy the latest web build into the Android project (run after build)
android\gradlew.bat assembleDebug     # local debug APK (JDK + Android command-line tools, no Android Studio)
```

Debug APKs are signed with a fixed key (`android/app/debug-signing.p12`, git-ignored). CI rebuilds that file from the `DEBUG_KEYSTORE_BASE64` repo secret, so every update installs over the previous app and keeps its data. Never commit the key: the repo is public.

The main way to get an APK is a GitHub Actions workflow that builds a debug APK on every push to main and uploads it as an artifact. A second workflow deploys the web build to GitHub Pages. The local Gradle build is the fallback.

## Architecture

**Stack:** Vite + React + TypeScript (strict), Dexie over IndexedDB, PapaParse, vite-plugin-pwa, Capacitor (Android), Vitest. Styling is plain CSS or CSS modules. There is no UI framework and no chart library (the 7-day chart is hand-written SVG). Keep dependencies few.

**One build, two shells.** The same web build runs as a PWA on GitHub Pages (Vite `base` must match the repo path) and inside Capacitor as the Android app. Code that differs by platform goes behind a small service with a web and a native implementation:
- Text-to-speech: `speak(text, lang)` uses the Web Speech API on web and `@capacitor-community/text-to-speech` on Android, because speechSynthesis in the Android WebView is unreliable. If a language has no voice, it falls back to the default voice and shows a notice once.
- Export: a browser download on web. On Android it writes the file to the cache directory with `@capacitor/filesystem`, then opens the `@capacitor/share` sheet, with "Save to Documents" as a second option.
- Import: `<input type="file">` on both platforms, accepting MIME types broadly and validating by content.
- Also platform-specific: the hardware back button (`@capacitor/app`), safe areas and the status bar, and the default device label ("laptop" on web, "phone" on Android).

**Data (Dexie).** Tables: sets, cards, review state (one per card), and review log (device-only, feeds stats). IDs are UUIDs. Deletes are soft: set `deleted = true` and bump `updatedAt` so deletions sync as tombstones. Every UI query must filter out deleted rows. Card images are device-only Blobs (resized to max 800 px JPEG) and never go into CSV. Call `navigator.storage.persist()` on first run. The app name lives in one config constant. The Android app id is `com.melyap.flashcards`.

**Scheduler.** An SM-2 variant written as pure functions in its own file (spec: "Spaced repetition scheduler"). Pass in the current time and the random source for fuzz so it stays pure and testable. "Mastered" means the card is in review state with an interval of at least 21 days.

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

Keep CSV parsing and serialization, merge, the scheduler and the writing-answer checker in pure modules, separate from Dexie and React. Those are the surfaces the spec's Vitest suite covers.
