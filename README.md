# AEP Schema Architect

A browser-based tool for designing Adobe Experience Platform (AEP) XDM schema mapping documents. Upload an XDM JSON schema or a source data dictionary, enrich it with field groups, identity markers, and array assignments, then export a DA-approved 24-column mapping document as Excel or machine-readable JSON.

![screenshot](docs/screenshot.png)

---

## Features (Phase 1)

- **XDM JSON parsing** — upload any XDM-compliant JSON; the tool walks the full tree and extracts every leaf field with its full path, object path, data type, array markers, and tenant classification
- **24-column mapping table** — 13 standard + 11 extended columns, all editable inline
- **Group ordering** — rows grouped by XDM object path; identity groups float to top
- **Bulk apply** — select rows and apply field group, object path, array config, and identity in one click
- **Array segment picker** — per-row and bulk assignment of which object node is the array
- **Identity badges** — Primary and Secondary identity with single-Primary enforcement
- **Column show/hide** — toggle any column; hidden columns are preserved in data and included in exports
- **Custom columns** — add your own columns (e.g. DULE Labels, Notes, Priority)
- **Per-column filters** — multi-select drill-down filters with context-aware value lists
- **Undo / Redo** — 40-step history
- **Export Excel** — downloads `.xlsx` with metadata header, all columns, group-ordered rows
- **Export JSON** — versioned contract with `fieldGroups` summary, ready for downstream agents
- **No build step** — vanilla JS, open `index.html` directly in Chrome or Edge

---

## Quick start

```
Open index.html in Chrome or Edge
— or —
Visit the GitHub Pages URL (see deployment section below)
```

1. Enter a schema name in the top bar
2. Upload an XDM JSON file (or an Excel/CSV data dictionary) in Step 1
3. Select rows and assign field groups and object paths in Step 2
4. Click **Export Excel** or **Export JSON** to download

---

## File structure

```
aep-schema-architect/
  index.html                  shell — loads all modules
  css/
    styles.css                all styles
  js/
    column-schema.js          single source of truth for all 24 column definitions
    parser.js                 XDM JSON parsing (pure functions, no DOM)
    filter.js                 per-column multi-select filter logic
    render.js                 table rendering, cell editors, selection
    export.js                 Excel (SheetJS) and JSON contract download
    app.js                    state, history, event wiring, bulk apply
  api/
    agent.js                  Phase 2 stub — Vercel serverless function (not yet implemented)
  .github/
    workflows/
      deploy.yml              GitHub Actions — deploys to GitHub Pages on push to main
  vercel.json                 Phase 2 — routes /api/* to serverless functions
  .env.example                Phase 2 — documents ANTHROPIC_API_KEY
  README.md
```

---

## Development

No build step required. Edit files directly and refresh the browser.

```bash
# Serve locally (optional — not required, index.html opens directly)
npx serve .
# or
python -m http.server 8080
```

The tool works by opening `index.html` as a local file (`file://`) in Chrome or Edge. Firefox blocks some clipboard APIs in `file://` context; use a local server if testing on Firefox.

---

## Deployment

### GitHub Pages

Push to `main` — GitHub Actions automatically deploys to GitHub Pages.

1. Go to **Settings → Pages** in your GitHub repo
2. Set source to **GitHub Actions**
3. Push to `main`

The workflow is at `.github/workflows/deploy.yml`.

### Vercel (Phase 2)

When Phase 2 is ready, deploy to Vercel instead:

```bash
vercel deploy
```

Set `ANTHROPIC_API_KEY` in the Vercel project environment variables. Static files serve from the same CDN; `/api/*` routes to the serverless functions.

---

## Adding a new column

All column metadata lives in `js/column-schema.js`. To add a column, add one entry to the `COLUMNS` array:

```js
{ key: "My New Column", renderAs: "text", defaultVisible: false, filterable: false, exportable: true }
```

Nothing else needs to change. The renderer, filter, and export modules all read from this config.

---

## Phase 2 — AI agent architecture

Phase 2 adds a conversational AI agent that reads any input format (messy Excel, SQL DDL, Salesforce exports, Word docs) and produces a pre-filled standard mapping table.

**Architecture:**

```
Browser                    Vercel                     Anthropic
  │                          │                            │
  │── POST /api/agent ───────▶│                            │
  │   { document, history }  │── claude-sonnet-4-6 ───────▶│
  │                          │◀─ structured mapping JSON ──│
  │◀─ { rows, fieldGroups,   │                            │
  │    agentNotes, reply } ──│
  │
  │  Pre-fills mapping table
  │  Colours rows by confidence (green/amber/red)
  │  Chat panel drives clarification conversation
```

The `api/agent.js` stub is already in place. Phase 2 requires:
1. Setting `ANTHROPIC_API_KEY` in Vercel environment
2. Implementing the agent prompt and response parsing in `api/agent.js`
3. Adding `js/chat.js` (chat panel UI) and `js/confidence.js` (row colouring)

The JSON contract produced by Phase 1 is versioned (`"version": "1.0"`) and includes an `agentNotes` array, so Phase 2 output is backward-compatible with Phase 1 consumers.

---

## License

MIT
