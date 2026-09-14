# ILDF DAR Batangas — Municipal Records Portal

A records portal for the Department of Agrarian Reform, Batangas Provincial
Office: browse DARMO clusters → municipalities → title folders, and upload,
preview, and download supporting documents.

This version replaces the original single-file, browser-only prototype with
a real Node.js + Express backend, a SQLite database, and files stored on
disk — so records survive page refreshes, work across devices, and can
actually be previewed in the browser.

## Why the old version couldn't preview files

The original `index.html` kept everything — including uploaded files — as
base64 text inside the browser's `localStorage`. Two things broke preview:

1. **Chrome (and most modern browsers) block top-level navigation to
   `data:` URLs** for security reasons, so clicking "Preview" silently did
   nothing or opened a blank tab.
2. `localStorage` has a hard ~5–10MB ceiling per site. Base64 inflates file
   size by ~33%, so it took very few real documents before saves started
   failing quietly.

This version fixes both: files are saved to disk (`data/uploads/`) and
served from real backend routes (`/api/files/:id/preview` and
`/…/download`) with correct `Content-Type` / `Content-Disposition`
headers, which every browser can open normally.

## Stack

- **Backend:** Node.js, Express
- **Database:** SQLite (via `better-sqlite3`) — stores users, folders, and
  file metadata
- **File storage:** local disk (`data/uploads/`), referenced by the database
- **Auth:** signed session cookie (`cookie-session`) + bcrypt password hashes
- **Frontend:** plain HTML/CSS/JS (no build step) in `public/`

## Project structure

```
├── server.js              # Express app entrypoint
├── src/
│   ├── db.js               # SQLite setup + schema + default admin seed
│   ├── clustersData.js      # Static cluster/municipality/category data
│   ├── middleware/auth.js   # Session auth guard
│   └── routes/
│       ├── auth.js          # /api/login, /logout, /session, /change-password
│       ├── clusters.js      # /api/clusters
│       ├── folders.js       # /api/folders (create/list/get/delete)
│       └── files.js         # upload, preview, download, delete
├── public/
│   ├── index.html
│   ├── css/styles.css
│   ├── js/api.js            # fetch() wrapper for the API
│   ├── js/app.js            # UI rendering + state
│   └── assets/logo.webp
├── data/                    # SQLite file + uploaded documents (gitignored)
├── railway.json
└── .env.example
```

## Running locally

Requires Node 18+.

```bash
npm install
cp .env.example .env      # edit SESSION_SECRET at least
npm start
```

Then open http://localhost:3000.

**Default login:** `admin` / `admin123` (seeded automatically on first run —
change it immediately from the account once logged in, or set
`DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` in `.env` before the
first boot).

## Deploying to Railway

1. Push this project to a GitHub repo, or use `railway up` from this folder
   with the [Railway CLI](https://docs.railway.app/guides/cli).
2. In the Railway dashboard, create a new project from the repo (or the CLI
   upload). Railway auto-detects Node.js via Nixpacks and reads
   `railway.json` for the start command.
3. **Add a Volume** and mount it at `/data`, then set the environment
   variable `DATA_DIR=/data`. Without a volume, the SQLite file and
   uploaded documents live on the container's ephemeral filesystem and are
   **wiped on every redeploy**.
4. Set environment variables under the service's **Variables** tab:
   - `SESSION_SECRET` — a long random string
   - `DATA_DIR=/data`
   - `NODE_ENV=production`
   - optionally `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` for the
     first boot
5. Deploy. Railway provides `PORT` automatically — the app already reads
   `process.env.PORT`.

## API overview

| Method | Path                          | Description                          |
|--------|-------------------------------|---------------------------------------|
| POST   | /api/login                    | Sign in                               |
| POST   | /api/logout                   | Sign out                              |
| GET    | /api/session                  | Current session status                |
| POST   | /api/change-password          | Change the logged-in user's password  |
| GET    | /api/clusters                 | Static cluster/municipality/category data |
| GET    | /api/folders?cluster=&municipality= | List title folders                |
| POST   | /api/folders                  | Create a title folder                 |
| GET    | /api/folders/:id               | Folder detail + its files             |
| DELETE | /api/folders/:id               | Delete a folder and its files         |
| POST   | /api/folders/:id/files         | Upload a file (multipart, field `file`) |
| GET    | /api/files/:id/preview         | Stream file inline (for viewing)      |
| GET    | /api/files/:id/download        | Stream file as an attachment          |
| DELETE | /api/files/:id                 | Delete a file                         |

All routes except `/api/login` require an active session.

## Notes

- Upload limit is 25MB per file (adjust `MAX_FILE_SIZE` in
  `src/routes/files.js` if needed).
- Cluster, municipality, and document-category lists are static data in
  `src/clustersData.js` — edit that file to add/rename offices.
- The "Merge to PDF" action from the original prototype was a stub with no
  real implementation; it has been removed pending a real requirement for
  which library/approach to use.
