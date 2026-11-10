# Hotel Booking API

## Favorites

Authenticated users (including admins) can manage their own wishlist:
`GET /api/v1/favorites?page=1&limit=25&currency=THB`,
`PUT /api/v1/favorites/:hotelId`, `DELETE /api/v1/favorites/:hotelId`.
PUT/DELETE are idempotent, and a unique user/hotel index prevents duplicate votes.
Public `GET /api/v1/hotels/top-favorites?currency=THB` uses MongoDB aggregation
to return up to three favorited hotels with favoriteCount, sorted by count
descending, then name and ID ascending. Unfavorited hotels are excluded.
Hotel deletion also removes its favorites in the same transaction.

## Monthly booking CSV (admin)

`GET /api/v1/reports/bookings/monthly?year=2026&month=11` downloads
`bookings-2026-11.csv`. The month is based on booking **createdAt** in
Asia/Bangkok, while exported timestamps are ISO UTC and stay dates retain the
existing UTC calendar-day convention. All current bookings in that month are
exported, without pagination; deleted bookings are not included.
The UTF-8 BOM CSV contains booking rows and a final `recordType=summary` row
with totalBookings/totalNights. User/hotel text is CSV-escaped and protected
against spreadsheet formula injection. Empty months return zero totals.
No revenue is inferred from current hotel prices: bookings have no historical price.

## Booking audit history

Booking updates/deletes and hotel cascade deletes automatically append to the
`auditlogs` collection with timestamp, actor ID/role, booking ID, action, reason
and before/after snapshots. Failed or unauthorized requests do not create logs.
Changes and logs commit in the same MongoDB transaction: audit failure rolls
back the operation. Use MongoDB Atlas or a replica set (standalone MongoDB is
not supported for these mutations). Tests run a single-member replica set.
Audit history is retained after booking/hotel deletion; no public mutation API
for audit logs is exposed. Application logging covers these service paths;
manual database changes are outside this audit mechanism.

## Currency prices

Hotels may have `pricePerNightSatang` (nonnegative safe integer, THB satang).
Existing hotels without a price return `displayPrice.amount: null`.
Admins can set the price with the existing hotel create/update endpoints.
Use `GET /api/v1/hotels?currency=USD` or `/api/v1/hotels/:id?currency=JPY`.
Supported currencies: THB (default), USD, EUR, JPY. Responses include
`displayPrice` with amount, currency, baseCurrency, rate, rateUpdatedAt and stale.
Set `EXCHANGE_RATE_API_KEY` in `.env` for ExchangeRate-API standard requests.
Rates are cached for one hour; provider timestamps determine their actual freshness
(not tick-by-tick market rates). On failure, cached rates no older than 48 hours
may be returned with `stale: true`; otherwise conversion returns 503. THB needs no key.
Provider documentation: https://www.exchangerate-api.com/docs/standard-requests

A REST API backend for a hotel booking system, built with **Node.js + Express** and **MongoDB Atlas (Mongoose)**.
Software Development Practice course project — **Project #1: Hotel Booking**. The assignment brief is in [`docs/`](docs/).

> **Status:** auth, hotels and bookings are implemented and tested; the endpoints below are the live contract.

The API is used and tested via **Postman**. A separate React + Vite frontend
for hotel discovery, Favorites and Top 3 is in [`frontend/`](frontend/README.md).
Run backend `npm run dev`, then `cd frontend`, `npm ci`, `npm run dev` and open
http://127.0.0.1:5173. Frontend build/lint/browser tests are run separately.

---

## Features

- **Register** with name, telephone number, email and password.
- **Log in** with email + password, and **log out**.
- **Browse hotels** — each hotel has a name, address and telephone number.
- **Book a hotel** for **1 – 3 nights** by choosing a hotel and check-in / check-out dates.
- **Users** can view, edit and delete **their own** bookings.
- **Admins** can view, edit and delete **any** booking, and manage the hotel list.

## Tech Stack

| Concern        | Choice                                           |
| -------------- | ------------------------------------------------ |
| Runtime        | Node.js (LTS)                                    |
| Framework      | Express 5                                        |
| Database       | MongoDB Atlas via Mongoose                       |
| Auth           | JWT (Bearer header **or** httpOnly cookie), bcrypt password hashing |
| Security       | helmet, CORS, rate limiting (`RATE_LIMIT_MAX` per 10 min, default 100), NoSQL-injection sanitization |
| Testing        | Jest + Supertest (+ mongodb-memory-server), Postman collection |

## Architecture

Layered design — each layer only talks to the one below it:

```
HTTP request
   │
   ▼
routes/        → URL + HTTP method → middleware chain → controller
middleware/    → auth (protect / authorize), validation, error handling
controllers/   → read req, call service, shape the HTTP response
services/      → business rules (3-night limit, ownership checks, ...)
models/        → Mongoose schemas (User, Hotel, Booking)
   │
   ▼
MongoDB Atlas
```

### Planned folder structure

```
hotel-booking-api/
├── docs/                      # assignment brief, design notes
├── postman/                   # Postman collection + environment
├── scripts/
│   ├── seed.js                # npm run seed / seed:destroy
│   └── seedAdmin.js           # npm run seed:admin
├── src/
│   ├── app.js                 # express app: middleware + route mounting
│   ├── server.js              # entry point: connect DB, start listening
│   ├── config/
│   │   └── db.js              # mongoose connection
│   ├── models/
│   │   ├── User.js
│   │   ├── Hotel.js
│   │   └── Booking.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── hotel.routes.js
│   │   └── booking.routes.js
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   │   ├── auth.js            # protect, authorize(...roles)
│   │   └── errorHandler.js
│   └── utils/
│       └── ApiError.js
├── tests/
└── package.json
```

## Data Model

**User**

| Field      | Type   | Notes                                   |
| ---------- | ------ | --------------------------------------- |
| name       | String | required                                |
| tel        | String | required                                |
| email      | String | required, unique, valid email format    |
| password   | String | required, min 6 chars, bcrypt-hashed, never returned |
| role       | String | `user` (default) or `admin`             |
| createdAt  | Date   |                                         |

**Hotel**

| Field   | Type   | Notes              |
| ------- | ------ | ------------------ |
| name    | String | required, unique   |
| address | String | required           |
| tel     | String | required           |

**Booking**

| Field        | Type     | Notes                                       |
| ------------ | -------- | ------------------------------------------- |
| user         | ObjectId | ref `User`, required                        |
| hotel        | ObjectId | ref `Hotel`, required                       |
| checkInDate  | Date     | required, not in the past                   |
| checkOutDate | Date     | required, after check-in, **≤ 3 nights** later |
| createdAt    | Date     |                                             |

## API Endpoints

Base URL: `/api/v1`

### Auth

| Method | Endpoint          | Access  | Description                    |
| ------ | ----------------- | ------- | ------------------------------ |
| POST   | `/auth/register`  | Public  | Register a new user            |
| POST   | `/auth/login`     | Public  | Log in, returns JWT            |
| GET    | `/auth/logout`    | Private | Log out (clears token cookie)  |
| GET    | `/auth/me`        | Private | Get the current user's profile |

### Hotels

| Method | Endpoint       | Access | Description       |
| ------ | -------------- | ------ | ----------------- |
| GET    | `/hotels`      | Public | List hotels (sorted by name; `?page=1&limit=25`, max 100) |
| GET    | `/hotels/:id`  | Public | Get one hotel     |
| POST   | `/hotels`      | Admin  | Create a hotel    |
| PUT    | `/hotels/:id`  | Admin  | Update a hotel    |
| DELETE | `/hotels/:id`  | Admin  | Delete a hotel (and its bookings) |

### Bookings

| Method | Endpoint                    | Access         | Description                                  |
| ------ | --------------------------- | -------------- | -------------------------------------------- |
| GET    | `/bookings`                 | User / Admin   | User: own bookings · Admin: all bookings     |
| GET    | `/hotels/:hotelId/bookings` | Admin          | All bookings for one hotel                   |
| GET    | `/bookings/:id`             | Owner / Admin  | Get one booking                              |
| POST   | `/hotels/:hotelId/bookings` | User / Admin   | Create a booking (1–3 nights)                |
| PUT    | `/bookings/:id`             | Owner / Admin  | Edit a booking                               |
| DELETE | `/bookings/:id`             | Owner / Admin  | Delete a booking                             |

Booking lists are paginated like `GET /hotels` (`?page=1&limit=25`, max 100) and sorted by check-in date. Each booking includes its `hotel` (`name`, `address`, `tel`); admin lists also include the `user` (`name`, `email`, `tel`).

Accessing another user's booking returns `403`.

#### Booking rules

Request body for create / update:

```json
{ "checkInDate": "2026-12-01", "checkOutDate": "2026-12-03" }
```

- Dates are calendar days in **UTC**: any time of day is dropped, so nights are always whole days.
- Nights = check-out − check-in and must be **1–3**. Check-in may be today but not in the past.
- On update you may send one or both dates; the resulting stay is re-checked against the same rules.
- Only the dates can be updated — `user` and `hotel` are fixed when the booking is created (`user` always comes from the token).

| Problem | `400` message |
| --- | --- |
| Missing date | `Please add a check-in date` / `Please add a check-out date` |
| Unparseable date | `Invalid check-in date` / `Invalid check-out date` |
| Check-in in the past | `Check-in date cannot be in the past` |
| 0 nights, or check-out before check-in | `Check-out date must be after check-in date` |
| More than 3 nights | `Booking cannot exceed 3 nights` |

### Response format

```jsonc
// success
{ "success": true, "data": { ... } }
// success (list)
{ "success": true, "count": 2, "data": [ ... ] }
// success (paginated list: GET /hotels, GET /bookings, GET /hotels/:hotelId/bookings)
{ "success": true, "count": 2, "pagination": { "page": 1, "limit": 25, "total": 2, "pages": 1 }, "data": [ ... ] }
// error
{ "success": false, "message": "Booking cannot exceed 3 nights" }
```

Status codes: `200` OK · `201` Created · `400` validation error · `401` not logged in / bad credentials · `403` not allowed · `404` not found · `500` server error.

## Non-Functional Requirements (from the brief)

| Requirement | How it is met |
| --- | --- |
| Authenticate with username–password | Email + bcrypt-hashed password → signed JWT |
| Keep user transactions confidential | Every booking query is scoped to the logged-in user unless the caller is an admin; passwords never returned |
| Respond within 3 seconds | Indexed lookups (`email`, `booking.user`, `booking.hotel`), lean queries, no N+1 populates |
| Used and tested via Postman | Postman collection + environment in `postman/` |
| Original REST API scope | Express JSON API; optional Favorites frontend added for updated requirements |
| MongoDB Atlas or PostgreSQL | MongoDB Atlas |

## Getting Started

```bash
git clone https://github.com/NitipoomPansayor/hotel-booking-api.git
cd hotel-booking-api
npm install
cp .env.example .env      # then fill in MONGO_URI, JWT_SECRET and the ADMIN_* values
npm run seed:admin        # create the admin account
npm run seed              # optional: load sample hotels, users, bookings and favorites
npm run dev               # nodemon, http://localhost:5000
```

### Scripts

| Command          | Purpose                     |
| ---------------- | --------------------------- |
| `npm run dev`    | Start with nodemon          |
| `npm start`      | Start in production mode    |
| `npm test`       | Run Jest test suite         |
| `npm run lint`   | Lint with ESLint            |
| `npm run seed:admin` | Create or promote the admin account from `ADMIN_*` env vars |
| `npm run seed`   | Load sample data (see [Sample data](#sample-data)) |
| `npm run seed:destroy` | Remove the sample data |

### Creating an admin

Registration always creates `role: "user"`; the API never accepts `role` from a request. To get an admin, set `ADMIN_NAME`, `ADMIN_TEL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` and run:

```bash
npm run seed:admin
```

| If the account with `ADMIN_EMAIL`… | The script… |
| --- | --- |
| doesn't exist | creates it with `role: "admin"` |
| exists as a normal user | promotes it to admin; its name, tel and **password are left unchanged** |
| is already an admin | does nothing |

It's safe to run more than once, and it never prints the password. Only `MONGO_URI` and `ADMIN_EMAIL` are required to promote an existing account; creating a new one also needs a valid name, tel and password.

### Sample data

Set `SEED_USER_PASSWORD` (at least 6 characters) in `.env` and run `npm run seed` to load the fictional data in `src/data/sampleData.js`:

| What | Count | Notes |
| --- | --- | --- |
| Hotels | 8 | Bangkok, Chiang Mai, Phuket, Krabi, Hua Hin and Ayutthaya; one has no price |
| Users | 4 | `somchai@`, `malee@`, `anan@`, `pim@example.com`, all `role: "user"` and all with password `SEED_USER_PASSWORD`; Pim has no bookings or favorites |
| Bookings | 5 | Dated from the day you run the seed (one checks in today), 1–3 nights each |
| Favorites | 8 | Riverside Orchid Bangkok is the top favorite |

The seed only adds what's missing: existing hotels (matched by name) and accounts (matched by email) are left untouched, and a sample user who already has bookings gets no new ones, so it's safe to re-run. It never creates or changes an admin, so run `npm run seed:admin` for that.

`npm run seed:destroy` deletes the sample hotels and sample users, along with **every** booking and favorite attached to them. That includes other users' bookings at a sample hotel. These deletions are not written to the audit log. Admin accounts are never deleted.

## Testing with Postman

Import `postman/hotel-booking-api.postman_collection.json`, open the collection's **Variables** tab, and set the **Current value** of `adminPassword` to the password of the account created by `npm run seed:admin` (see [Creating an admin](#creating-an-admin)). `adminEmail` defaults to `admin@example.com`; change it if yours differs. Press Ctrl+S, then run the whole collection with the Collection Runner. If the admin login is missing, **Login as Admin** fails first and says so; every admin request after it, and everything that needs the test hotel, fails too.

No environment is needed: `baseUrl` defaults to `http://localhost:5000/api/v1`, and values saved during a run (tokens, ids) are stored as collection variables. The optional `postman/hotel-booking-api.postman_environment.json` contains only `baseUrl`, for pointing the collection at another server.

The collection has 96 requests covering every endpoint, run in this order: **Auth → Hotels → Currency prices → Bookings → Favorites → Reports → Cleanup**.

- **Re-runnable:** each run registers two new users with unique emails and creates its own hotel, and Cleanup deletes the hotel (and with it, its bookings and favorites). The test users stay in the database, since there's no API to delete users. The first request, **Start run**, picks the new emails, hotel name and a random password in its post-response script; values set in pre-request scripts do not reliably carry over to later requests in the Postman app.
- **Two users:** the second user owns a booking, so the 403 checks for other people's bookings are real.
- **Bearer tokens only:** tokens are saved to `{{token}}`, `{{otherToken}}` and `{{adminToken}}` and sent as `Authorization: Bearer`. Cookies are disabled per request, so the login cookie can't hide a 401.
- **Failure cases:** requests whose name ends in `(400)`, `(401)`, `(403)` or `(404)` deliberately fail, and they check the exact status and error message.
- **Dates:** booking dates are computed relative to today by a collection-level pre-request script, so the collection never goes stale.
- **Response time:** every request checks the 3-second requirement.
- **Currency:** USD/EUR/JPY requests accept `503` when `EXCHANGE_RATE_API_KEY` isn't set; THB always returns `200`.

The API allows `RATE_LIMIT_MAX` requests per 10 minutes per client (default 100; the limiter is off under `NODE_ENV=test`). One run is 96 requests, so with the default a second run within 10 minutes gets `429`. For local testing, set `RATE_LIMIT_MAX=1000` in `.env` and restart the server. Keep the default in production.

From the command line, `newman run postman/hotel-booking-api.postman_collection.json` works the same way. Set the admin login in the collection's variables first (environment variables override collection variables, so `--env-var adminEmail=<email> --env-var adminPassword=<password>` also works).
