# Support Analytics Dashboard

Interactive dark-theme dashboard for support conversation analytics.

## Features

- Upload and analyze `CSV`, `Excel` (`.xlsx/.xls`), and `JSON` datasets
- Large dataset mode for big CSV files (streaming analysis, low-memory preview table)
- Session-only storage in browser memory (`sessionStorage`)
- Multi-tab analytics UI:
  - Overview
  - Data Explorer
  - Handovers
  - Problem Analysis
  - Dataset Comparison
- Handover detection via keyword/escalation/failure-loop signals
- Problem clustering with top issues + example conversations
- Optional AI enrichment with OpenAI `gpt-5.2` (can be toggled off for sensitive data)
- Working clear-data flow with confirmation warning

## Large Dataset Notes (2M+ rows)

- For very large files, use `CSV` for best performance.
- CSV uploads are streamed and analyzed in chunks with PapaParse worker mode to avoid loading all rows into browser memory and keep the UI responsive.
- The Data Explorer shows a preview slice for large files while analytics are computed from the full stream.
- Session restore stores a compact preview for very large datasets to avoid browser storage quota issues.
- For very large `Excel`/`JSON` files, convert to CSV first.

## Run locally

Use any static file server:

```bash
npx serve .
```

or

```bash
python -m http.server 8080
```

## Deploy on Vercel

1. Import this folder as a Vercel project.
2. Framework preset: `Other`.
3. Build command: none.
4. Output directory: `.`

`vercel.json` is included for static hosting defaults.

## Deploy on Render

1. Create a new **Static Site** from this folder/repo.
2. Publish directory: `.`
3. Build command: none.

`render.yaml` is included for one-click infra config.
