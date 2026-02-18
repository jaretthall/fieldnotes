# Getting Fieldnotes Up and Running

This guide gets the Fieldnotes desktop app running on your machine.

## Prerequisites

- **Node.js 20 or newer** — [Download](https://nodejs.org/) if you don’t have it. Check with: `node -v`
- **pnpm** — The project uses pnpm. Install with: `npm install -g pnpm` (then run `pnpm -v` to confirm)

Optional (for full features later):

- **Ollama** — For AI categorization of entries (mood, tags, title). Install from [ollama.ai](https://ollama.ai) and pull a model, e.g. `ollama pull llama3.2:3b`
- **Whisper model** — For voice-to-text. The app can work in text-only mode without it.

## Steps to Run

1. **Open a terminal** and go to the **`fieldnotes`** folder (the one that contains `package.json`).  
   If you're in the parent `FieldNotes` folder, run: **`cd fieldnotes`** first.  
   (Running `pnpm dev` from the parent folder will fail with "No package.json found".)

2. **Install dependencies** (if you haven’t already):
   ```bash
   pnpm install
   ```
   This can take a minute. If you see errors about `better-sqlite3`, run:
   ```bash
   pnpm run postinstall
   ```
   then try `pnpm dev` again.

3. **Start the app in development mode:**
   ```bash
   pnpm dev
   ```

4. An **Electron window** should open with the Fieldnotes UI. The first time you run, the app will create a local SQLite database at:
   - **Windows:** `%APPDATA%\fieldnotes\data\fieldnotes.db`
   - **macOS:** `~/Library/Application Support/fieldnotes/data/fieldnotes.db`

## If Something Goes Wrong

- **“Cannot find module” or build errors:** Run `pnpm install` again from the `fieldnotes` folder.
- **Electron window doesn’t open:** Check the terminal for red error messages; they usually point to the cause.
- **Electron window shows unstyled UI (plain text, no colors):** The app uses port 5174 for the renderer. Try:
  1. Open `http://localhost:5174` in your browser — does it look styled? If yes, the issue is Electron-specific.
  2. Run with DevTools: `$env:ELECTRON_OPEN_DEVTOOLS=1; pnpm dev` (PowerShell) or `ELECTRON_OPEN_DEVTOOLS=1 pnpm dev` (bash). In the Network tab, check if any CSS files fail to load (red/404).
  3. Check the terminal for `[Electron] Loading renderer from: http://localhost:5174/` — that confirms the correct URL.
- **Database errors:** You can delete the `fieldnotes.db` file in the path above (and the `data` folder if empty) to start fresh; the app will recreate it on next launch.

## Other Commands

- **Build for production:** `pnpm build` — creates installable app in the `release` folder.
- **Run tests:** `pnpm test`

Once the app is open, you can create journal entries with text. Voice entry and AI tags require the optional Whisper and Ollama setup described in the main blueprint.
