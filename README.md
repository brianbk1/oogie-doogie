# The BK Consulting Group — Pre-kickoff app (v1)

Runs the pre-kickoff process for business-strategy engagements:

1. **Client questionnaire** — you send a link; the client answers one section per screen (progress bar, autosave on their device, "save progress file" to resume on another computer, examples of good answers, mixed question types, optional document uploads). At the end they download one response file (.zip) and email it to you.
2. **Your review** — import the response file (or a questionnaire completed in Word / PDF / Excel / text — an AI maps it onto your questions, and anything new is added to your master questionnaire). Flag answers as vague or contradictory (the app suggests some, e.g. runway that doesn't match cash ÷ burn), add notes, copy a follow-up email.
3. **Kickoff deck + project plan** — "Copy prompt" → paste into ChatGPT / Claude / Copilot → paste the JSON reply → **Build deck + plan** (one click, with Undo). Or **Draft with AI** via the Vercel function. Or **Start from the answers** (no AI). AI-drafted slides and plan rows are tagged "AI" until you verify them. Exports: PowerPoint (native editable charts + speaker notes), PDF, and Excel (live Gantt).

## Where data lives (no database)

- **Client side:** answers stay in the client's browser until they download the response file. Attached documents are packed into that .zip.
- **Your side:** imported clients, notes, flags, decks and plans live in *your* browser (IndexedDB). Use **Settings → Download backup** regularly; **Restore** on another computer.
- **Links:** the client name and your added questions are packed into the part of the link after `#`, which browsers never send to a server.
- **AI:** only used when you click "Draft with AI" / "Map with AI" (sends the brief to Anthropic through your Vercel function), or when you paste the prompt into an AI yourself.

## Deploy on Vercel

1. Push this folder to a GitHub repo (e.g. `brianbk1/bkcg-kickoff`) and import it in Vercel. Framework preset: **Vite** (build `npm run build`, output `dist`).
2. Optional — built-in AI: Vercel → Project → Settings → Environment Variables:
   - `ANTHROPIC_API_KEY` — turns on "Draft with AI" and "Map with AI".
   - `ADMIN_KEY` — recommended. Any long random string; enter the same value in the app under **Settings**. Without it, anyone who finds your site could spend your API credits.
   - `ANTHROPIC_MODEL` — optional override (default `claude-sonnet-5-5`).
   Redeploy after adding variables.
3. Open the site → **Settings**: add your email (clients' "Open a new email" button goes to it).

New Vercel projects run functions with Fluid compute (up to 300 s on Hobby), which covers a full deck draft (usually 1–3 minutes).

### Routes
- `/` — your workspace (admin). There is no login: everything shown comes from your own browser's storage, so another visitor sees an empty workspace.
- `/#/q/…` — a client's questionnaire link (create it under **+ New client link**).
- `/#/questionnaire` — the generic questionnaire with no client name.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173 (the /api/ai function only runs on Vercel or `vercel dev`)
npm run sample       # builds sample-output/ : sample deck (.pptx/.pdf) + plan (.xlsx) from fake answers
```

## What's reused from mgr-acct-class

`src/lib/slides/layouts.js` (one layout engine → SVG preview, PDF via jsPDF, PPTX via pptxgenjs), `src/lib/slides/backends.js`, `src/components/SlideSvg.jsx`, and `DeckBuilder.jsx` (three-step AI flow, filmstrip, per-layout editor, text-fit rules, word limits, paste guard, Undo).
Changes: BKCG palette; charts come from questionnaire answers or inline numbers; executive-summary tiles fill from the slides that follow; new **ranked** (severity bars) and **timeline** (fills from the project plan) layouts; a "what you told us" appendix.

## Files

```
api/ai.js                     Vercel function → Anthropic (deck drafting + questionnaire mapping)
src/lib/questions.js          Built-in questionnaire (sections, questions, examples)
src/lib/master.js             Built-in + added questions ("master questionnaire")
src/lib/link.js               Pack/unpack client links
src/lib/responseFile.js       The client's response .zip (responses.json + readable answers.html + files/)
src/lib/mapping.js            Text extraction (docx/pdf/xlsx/csv/txt) + AI mapping prompt
src/lib/checks.js             Suggested vague / contradictory flags
src/lib/deckModel.js          Charts from answers, AI prompt + JSON parsing, starter deck/plan
src/lib/planExport.js         Excel export with live Gantt
src/lib/clients.js            Your client records + backup/restore (IndexedDB)
src/lib/sample.js             Fake client + sample AI reply for demos
src/components/…              Questionnaire, Admin, ResponsesView, MapFlow, DeckBuilder, PlanBuilder, MasterQuestions
```

To change the built-in questions, edit `src/lib/questions.js`. Questions you add in the app live under **Master questionnaire** (export them to keep a copy).
