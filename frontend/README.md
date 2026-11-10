# พัก / PAK — Favorites frontend

Standalone React + Vite frontend. Backend remains in the parent project.

## Run locally

1. Configure the backend `.env` from `.env.example` and run `npm ci`, `npm run dev` in the repository root.
2. In `frontend/`, run `npm ci` and `npm run dev`.
3. Open **http://127.0.0.1:5173**. Vite proxies `/api` to **http://127.0.0.1:5000**.

The app uses the existing httpOnly session cookie. Tokens are not persisted in
browser storage. Login, registration, personal favorites, public Top 3 and hotel
pagination use the real API. Prices support THB/USD/EUR/JPY; live conversion
requires the backend `EXCHANGE_RATE_API_KEY`. Hotels without a stored price show
“ยังไม่ระบุราคา”. No hotel records or popularity numbers are fabricated in the UI.

The UI covers discovery and favorites; booking CRUD and admin reports remain API/Postman workflows.

## Build and deploy

`npm run build` generates `dist/`. Serve it with an SPA fallback to `index.html`
and proxy `/api` to the backend **on the same origin**. HTTPS is required with
production secure cookies. Vite's development proxy does not apply to `vite preview`
or static production hosting; configure your reverse proxy there. Never expose
the currency API key through a Vite environment variable.

## Validation

- `npm run lint`
- `npm run build`
- `npx playwright install chromium` (once), then `npm test`
- Alternatively use an installed Chrome: PowerShell `$env:PLAYWRIGHT_CHANNEL='chrome'; npm test`

Browser tests start an isolated MongoDB replica set and backend (port 5000),
then Vite (5173). Keep these ports free. They never load the application `.env`
or modify Atlas data. All seed records and test credentials exist only in the
temporary test database. Tests cover login/register, favorite persistence,
removal, logout, API failures, pagination, mobile/landscape layout, keyboard
controls and reduced motion. Screenshots go to ignored `test-results/`.

For E: only caches on Windows, set before npm/Playwright commands:

```powershell
$env:npm_config_cache='E:\hotel-booking-api\.npm-cache'
$env:TEMP='E:\hotel-booking-api\.tmp'
$env:TMP=$env:TEMP
$env:PLAYWRIGHT_BROWSERS_PATH='E:\hotel-booking-api\.tmp\playwright'
$env:MONGOMS_DOWNLOAD_DIR='E:\hotel-booking-api\.mongodb-binaries'
```

Create the TEMP directory first. If a MongoDB executable already exists, set
`MONGOMS_SYSTEM_BINARY` to its full path to avoid another download.

UI direction follows `ui-ux-pro-max`; see `design-system/MASTER.md`. Thai and
Latin fonts are bundled locally through Fontsource, with no external font requests.
