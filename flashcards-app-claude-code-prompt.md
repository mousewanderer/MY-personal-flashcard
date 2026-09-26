You are building a personal flashcard study app for me. Its feature set is modeled on flashcards.world (based on their public help pages), but it is an original app: do not copy their name, logo, wording, or visual assets.

## How I will use it

- One user (me). No accounts, no server, no ads, no paid services.
- Laptop: a web page, installed as a PWA in Chrome or Edge on Windows.
- Phone: an Android app (an APK I sideload).
- The two devices never talk to each other directly. I sync by exporting a CSV on one device, moving the file (Google Drive, Messenger, USB), and importing it on the other. Importing must merge. It must never blindly overwrite.
- Everything works offline. All data is stored on the device.

## My setup and limits

- Main machine: Windows laptop (ASUS VivoBook). Write commands for PowerShell, and tell me when something needs Git Bash instead.
- I'm a 4th-year computer engineering student. I can follow technical steps, but keep setup light and avoid requiring full Android Studio if a lighter route works.
- My token budget is limited. Work in the phases at the bottom, stop at the end of each phase with a short summary, and wait for me to say "continue".

## Tech stack

Use this unless something blocks you. If it does, tell me why before switching.

- Vite + React + TypeScript (strict mode)
- IndexedDB through Dexie. Call `navigator.storage.persist()` on first run.
- PapaParse for CSV
- vite-plugin-pwa for offline support and install on the laptop
- Capacitor (current stable) to wrap the same build as an Android app
- Vitest for unit tests
- Plain CSS or CSS modules. No UI framework. Keep dependencies few.

App name: "Flashcards" as a placeholder, stored in one config constant so I can rename it. Android app id: `com.melyap.flashcards` (placeholder).

## Data model

Set
- id (UUID), title, description (optional), frontLang, backLang (BCP-47 such as en-US or fil-PH, used for text-to-speech), createdAt, updatedAt, deleted

Card
- id (UUID), setId, front, back, options (0 to 3 wrong answers for multiple choice), starred, position, image (optional, device-only Blob, resized to max 800 px JPEG), createdAt, updatedAt, deleted

Review state (one per card)
- srsState (new, learning, review, relearning), due, intervalDays, ease, reps, lapses, learningStep, lastReviewedAt

Review log (device-only, used for stats)
- cardId, timestamp, mode, rating

Deletes are soft (deleted = true, updatedAt bumped) so deletions can sync. Hide deleted items everywhere in the UI.

## Features

### Sets and cards

- Home: list of sets with card count, due-today count, and mastered percentage. Search box.
- Create, rename, duplicate, and delete a set (with a confirm dialog).
- Language pickers for the front and back of each set.
- Card editor: add, edit, delete, reorder (up/down buttons are fine), star, add or remove an image, add up to 3 wrong-answer options.
- Bulk add by pasting text: one card per line. Auto-detect the separator (tab, comma, semicolon, " - ", " : ") with a dropdown to override it, and show a live preview table before saving.
- Search cards within a set.
- Seed one small sample set on first launch that I can delete.

### Study modes

Every mode has a direction option (front to back, back to front, mixed), shuffle, "starred only", and an end-of-session summary: correct, wrong, time taken, the list of missed cards, and a "Study missed cards again" button.

1. Review (spaced repetition): only due cards plus up to the daily new-card limit. Show the front, tap or press Space to flip, then rate Again / Hard / Good / Easy. Show the next interval on each button.
2. Flashcards: flip through cards in order or shuffled and mark each Known or Unknown. Unknown cards come back later in the same session.
3. Multiple choice: 4 options. Use the card's own wrong options first, then fill the rest with other backs from the same set (no duplicates, never the correct answer). Needs at least 2 cards in the set. Highlight right and wrong answers instantly.
4. Writing: type the answer. Compare after normalizing (trim, lowercase, collapse spaces, ignore punctuation; ignoring accents is a setting). If the Levenshtein distance is small (default: 1 error allowed per 6 characters, rounded down, minimum 1), mark it "Almost", count it correct, and show the exact answer. Accept alternatives separated by "/" or ";" in the back text. Include an "I was right" override.
5. Match: tile grid of terms and definitions (6 pairs on phone, 8 on laptop). Tap a term, then its match. Correct pairs disappear and wrong pairs flash red. Timer, with the best time saved per set.
6. Drawing: a canvas (touch, mouse, stylus) to sketch the answer, then reveal and self-grade Known or Unknown. Clear and undo buttons.
7. Audio review: hands-free. Reads the front aloud in the front language, waits N seconds (a setting), reads the back in the back language, then moves on. Play, pause, skip, stop.
8. Custom quiz: choose the number of questions, question types (multiple choice, writing, true/false), direction, and source (all, starred, due, missed last session). Graded at the end with a score and a "Retry wrong answers" button.

How modes affect the schedule: Review and Flashcards always update spaced repetition (Known = Good, Unknown = Again). The other modes update it only for cards that are currently due (correct = Good, wrong = Again), so practicing ahead does not inflate intervals. Every answer in every mode goes into the review log.

### Spaced repetition scheduler

SM-2 style, written as pure functions in their own file.

- New and learning cards use steps of 1 minute and 10 minutes. Again returns to the first step, Good moves to the next step, and finishing the last step graduates the card to a 1-day interval. Easy graduates it immediately to 4 days.
- Review cards: Again is a lapse (lapses + 1, ease - 0.20, relearn through the 10-minute step, then interval = max(1, previous interval × 0.5)). Hard: interval × 1.2, ease - 0.15. Good: interval × ease. Easy: interval × ease × 1.3, ease + 0.15.
- Ease starts at 2.5 with a floor of 1.3. Round intervals to whole days. Good and Easy always give at least 1 day more than the previous interval. Add ±5% random fuzz to intervals over 3 days.
- "Mastered" means review state with an interval of 21 days or more.
- Daily new-card limit (default 20) in settings.

### Stats

- Per set: new / learning / mastered counts, due today, due tomorrow.
- Overall: cards reviewed today, current streak (days in a row with at least one review), and a 7-day bar chart drawn in plain SVG (no chart library).

### Text-to-speech

- A speaker button on cards, plus Audio review mode.
- Put it behind one service: `speak(text, lang)`. On web, use the Web Speech API. On Android, use `@capacitor-community/text-to-speech`, because speechSynthesis in the Android WebView is unreliable. If no voice exists for a language, fall back to the default voice and show a small notice once.

### Settings

Daily new-card limit, default direction, writing strictness (strict / normal / lenient), ignore accents, audio pause seconds, speech rate, theme (system / light / dark), and device label (default "laptop" on web and "phone" on Android).

## CSV import and export (this is the sync)

There are two formats. Parse with PapaParse as UTF-8, strip a BOM if present, and handle quoted fields containing commas, doubled quotes, and line breaks.

### Format A: Simple CSV (one set, compatible with flashcards.world)

- No header row. Column A = front, column B = back, columns C to E = optional wrong-answer options.
- Import: preview the first 10 rows, name the new set after the file name (editable), or pick "Add to existing set". If the first row looks like a header (front/back, term/definition, question/answer), offer to skip it. Also accept tab- and semicolon-separated files.
- Export: one set per file, no header, no BOM, file name = set title + ".csv".
- Carries card text only (no progress, no images), which matches what flashcards.world exports.

### Format B: Sync file (all sets, with progress)

- Header row with exactly these columns, in this order:
  `format, set_id, set_title, set_description, front_lang, back_lang, set_updated_at, set_deleted, card_id, position, front, back, option1, option2, option3, starred, card_updated_at, card_deleted, srs_state, due, interval_days, ease, reps, lapses, learning_step, last_reviewed_at`
- `format` is always `fcsync-1`. One row per card. A set with no cards gets one row with empty card columns. Timestamps are ISO 8601 UTC. Booleans are 0 or 1.
- Include deleted sets and cards (tombstones) so deletions sync.
- Export as UTF-8 with BOM so Excel shows accented letters correctly. File name: `flashcards-sync-YYYY-MM-DD-HHmm-{deviceLabel}.csv`
- On import, detect this format by its header (the `format` and `card_id` columns).

Merge rules on import:

- Match sets and cards by id. Unknown ids are added.
- Content fields (title, description, languages, front, back, options, starred, position, deleted): keep whichever side has the later updated_at.
- Review-state fields: keep whichever side has the later last_reviewed_at, independent of the content decision.
- Images never travel in CSV. Keep the local image when a card merges.
- Before writing anything, show a preview: new sets, new cards, updated cards, deleted cards, unchanged. Import only after I confirm.
- Before applying, snapshot the current database (keep the last 3 snapshots) and offer an "Undo last import" button.
- Reject a file with a wrong header or broken rows with a clear message listing the row numbers. Never import part of a file.

### Sync screen

- Buttons: Export sync file, Import file (auto-detects Format A or B), Export this set as simple CSV.
- Shows the last export time, the last import time with the source device label, and a banner "You have changes since your last export" when that is true.
- Short in-app instructions: export here, send the file to your other device, import it there.

## Platform details

### Web (laptop)

- PWA with offline support and an install button.
- Keyboard shortcuts: Space to flip, 1 to 4 for ratings and answers, arrow keys for next and previous, Enter to submit, Esc to leave a session. List them in a "?" help popup.
- Deploy to GitHub Pages with a GitHub Actions workflow (set the Vite base path correctly). Free GitHub Pages needs a public repo. My cards stay on my devices, so a public repo is fine, but confirm with me before the first push. `npm run dev` and `npm run preview` must also work locally.
- README note: the data lives in that browser for that site address. Clearing site data deletes it, so export a sync file regularly.

### Android (phone)

- Capacitor wrapping the same web build. Portrait orientation.
- Export: write the file with `@capacitor/filesystem` to the cache directory, then open the Android share sheet with `@capacitor/share` so I can save it to Drive or Files or send it. Also offer "Save to Documents".
- Import: a file picker through `<input type="file">`. Accept broadly (.csv, text/csv, text/comma-separated-values, text/plain, application/octet-stream) and validate by content, since Android pickers report CSV MIME types inconsistently.
- Hardware back button (`@capacitor/app`): goes back inside the app, asks before leaving a study session, and exits from the home screen.
- Respect safe areas and the status bar in both themes.
- App icon and splash: design a simple original icon (a small stack of cards) and generate the sizes with `@capacitor/assets`.
- APK build, two routes:
  1. Main route: a GitHub Actions workflow that builds a debug APK on every push to main and uploads it as a downloadable artifact, so my laptop needs nothing extra installed.
  2. Local route: document the minimum install (the JDK version current Capacitor requires, plus Android command-line tools, without full Android Studio) and the commands (`npx cap sync android`, then `android\gradlew.bat assembleDebug`).
- README section: how to install the APK on my phone (allowing installs from unknown sources).

### UI

- Mobile-first and responsive. Phone: bottom tab bar (Sets, Review, Sync, Settings). Laptop: left sidebar.
- Light and dark themes. Card flip animation, turned off when prefers-reduced-motion is set.
- Tap targets at least 44 px. Large, readable card text that scales down for long answers.
- Clean and plain. No emojis in the UI.

## Out of scope

Accounts, cloud sync, AI card generation, sharing by link or QR code, a public set library, Anki .apkg import, payments, analytics or tracking.

## Tests (Vitest)

- CSV: round trip of both formats with commas, quotes, line breaks inside cells, ñ and other accented letters, emoji, empty options, BOM handling, tab and semicolon detection, header-row detection.
- Merge: newer content wins, newer review state wins separately from content, tombstones propagate, unknown ids are added, bad files are rejected whole.
- Scheduler: every rating from every state, ease floor, lapse handling, fuzz bounds.
- Writing checker: normalization, the accents setting, typo tolerance, "/" and ";" alternatives.

## Phases (stop after each one)

- Phase 1, core web app: project setup, data layer, sets and cards CRUD, bulk paste, Review mode with the scheduler, Flashcards mode, simple CSV (Format A) import and export, settings, themes. Scheduler and CSV tests.
- Phase 2, sync: Format B export and import with preview, merge, snapshots, undo, and the Sync screen. PWA setup. Merge tests.
- Phase 3, Android: Capacitor setup, file export and share, import, back button, the TTS service (web and native), icon, GitHub Actions for the APK and for GitHub Pages, README. After this phase I should be able to sync between laptop and phone end to end.
- Phase 4, remaining modes: Multiple choice, Writing, Match, Custom quiz, Audio review, Drawing, session summaries, and the stats screen. Writing checker tests.
- Phase 5, only if I ask: Excel .xlsx import (SheetJS), a full backup .zip that includes images, and a memory (concentration) game.

At the end of every phase:

1. Run the tests and a production build. Fix failures before reporting.
2. Make a git commit with a clear message.
3. Give me a summary under 10 lines: what works, how to try it, and anything I need to install or decide.

## Ground rules

- Before starting, check the Node and git versions and tell me if I need to install anything.
- Ask me before adding a paid service, anything that needs an account other than GitHub, or any large new dependency.
- Keep edits focused. Do not rewrite working files without a reason.
- If part of this spec conflicts with how Capacitor or the browser actually behaves, choose the option that works and tell me in the phase summary.
