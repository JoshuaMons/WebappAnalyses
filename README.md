# Support Analytics Dashboard

Interactive dark-theme dashboard for support conversation analytics.

## Latest Release Notes

- See `RELEASE_NOTES_2026-04-14.md` for the full update summary.

## Features

- Auto-load support database from `/api/live-db` (online source) with fallback to local `/data/fontys_cgny.db`
- SQLite `.db` analysis using `sql.js`
- Persistent browser restore via `localStorage` + `sessionStorage`
- Multi-tab analytics UI:
  - Overview
  - Data Explorer
  - Handovers
  - Problem Analysis
  - AI Analysis
  - Detection Rules (editable keywords/threshold)
  - Dataset Comparison
- Handover detection via keyword/escalation/failure-loop signals
- Problem clustering with top issues + example conversations
- Optional AI enrichment with OpenAI `gpt-5.2` (can be toggled off for sensitive data)
- Working clear-data flow with confirmation warning

## Online Database Setup (Vercel)

1. Upload your `.db` file to a public file host (for example Vercel Blob public URL, R2 public URL, S3 public URL, etc.).
2. Set environment variable:

   - `SUPPORT_ANALYTICS_DB_URL=https://<your-public-db-url>/fontys_cgny.db`

3. Redeploy.

The dashboard first requests `/api/live-db`, and that API route proxies your online database URL.  
If `SUPPORT_ANALYTICS_DB_URL` is not set, the app falls back to local files (`/data/fontys_cgny.db` then `/fontys_cgny.db`).

## Convert SQLite To Uploadable SQL Dump

Use the included conversion script:

```bash
python scripts/export_sqlite_to_sql.py --input data/fontys_cgny.db --output "C:\Users\Josh\Downloads\fontys_cgny.sql.gz" --gzip
```

You can then upload the `.sql`/`.sql.gz` dump to your managed database host/import tool.

## Large Dataset Notes (2M+ rows)

- For very large tables, keep database indexing/partitioning on your hosted DB side.
- The dashboard renders from analyzed rows and keeps browser storage compacted automatically.

## Run locally

Use any static file server:

```bash
npx serve .
```

or

```bash
python -m http.server 8080
```

## Deploy on Vercel hoii


1. Import this folder as a Vercel project.
2. Framework preset: `Other`.
3. Build command: none.
4. Output directory: `.`

`vercel.json` is included for static hosting defaults.

### AI Proxy (recommended)

Set `OPENAI_API_KEY` in Vercel project environment variables to use the server-side AI proxy endpoint (`/api/ai-enrich`) and avoid browser-side network/CORS issues.


`render.yaml` is included for one-click infra config.
