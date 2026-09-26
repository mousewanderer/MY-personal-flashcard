# Flashcards

A personal, offline flashcard app: sets and cards, spaced repetition, several study modes, and CSV import/export. Everything is stored on your device (IndexedDB). There are no accounts and no server.

## Run it

```powershell
npm install
npm run dev       # development server at http://localhost:5173
npm run build     # production build into dist/
npm run preview   # serve the production build at http://localhost:4173
npm test          # unit tests
```

## Where your data lives

Cards are stored in the browser, separately for each site address. `localhost:5173` (dev) and `localhost:4173` (preview) keep **separate** data. If you clear the site data, your cards are deleted. Export your sets as CSV now and then (Export CSV on a set).

## CSV format

This is the simple format: no header row. Column A is the front, column B is the back, and columns C to E are optional wrong answers for multiple choice. Comma, tab and semicolon files can all be imported.
