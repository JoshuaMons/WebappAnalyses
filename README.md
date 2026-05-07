# Support Analytics Dashboard

Interactive dark-theme dashboard for support conversation analytics.

## Latest Release Notes

- See `RELEASE_NOTES_2026-04-14.md` for the full update summary.

## Features

- Auto-load support database from `/api/live-db` (online source) with fallback to local `/data/fontys_cgny.db`
- SQLite `.db` analysis using `sql.js`
- Persistent browser restore via `sessionStorage`
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
- Optional AI enrichment with OpenAI `gpt-4o` (can be toggled off for sensitive data)
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

## Import SQL Dump To Local SQLite (.db)

If you received a `.sql` dump (like `essent_dump.sql`) and want the dashboard to load it locally, convert it back to a SQLite `.db`:

```bash
python scripts/import_sql_dump_to_sqlite.py --input "C:\Users\Josh\Downloads\Essent\essent_dump.sql" --output data\essent.db --overwrite
```

The dashboard will try `/data/essent.db` first (then the other default sources).

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

### Optional: minify JS/CSS for local production build

```bash
npm install
npm run minify
```

## Deploy on Vercel

1. Import this folder as a Vercel project.
2. Framework preset: `Other`.
3. Build command: **none** (leave empty).
4. Output directory: `.`
5. Set environment variables (see `.env.example`):
   - `SUPPORT_ANALYTICS_DB_URL` — **required**; Vercel does not pull Git LFS files so the database must be hosted externally.
   - `OPENAI_API_KEY` — optional; enables the server-side AI proxy (`/api/ai-enrich`) to avoid browser CORS issues.

`vercel.json` is included with security headers and a custom 404 page.


`render.yaml` is included for one-click infra config.
