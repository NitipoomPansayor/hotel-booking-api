# Hotel Booking API

A REST API backend for a hotel booking system, built with **Node.js + Express** and **MongoDB Atlas (Mongoose)**.
Software Development Practice course project — **Project #1: Hotel Booking**. The assignment brief is in [`docs/`](docs/).

> **Status:** auth, hotels and bookings are implemented and tested; the endpoints below are the live contract.

There is no frontend — the API is used and tested via **Postman**.

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
| Security       | helmet, CORS, rate limiting, NoSQL-injection sanitization |
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
| Web REST API, no frontend | Express JSON API only |
| MongoDB Atlas or PostgreSQL | MongoDB Atlas |

## Getting Started

```bash
git clone https://github.com/NitipoomPansayor/hotel-booking-api.git
cd hotel-booking-api
npm install
npm run dev               # nodemon, http://localhost:5000
```

### Scripts

| Command          | Purpose                     |
| ---------------- | --------------------------- |
| `npm run dev`    | Start with nodemon          |
| `npm start`      | Start in production mode    |
| `npm test`       | Run Jest test suite         |
| `npm run lint`   | Lint with ESLint            |

### Creating an admin

Registration always creates `role: "user"`. Promote an account to admin directly in MongoDB Atlas (set `role` to `"admin"`) or via a seed script.

## Testing with Postman

Import `postman/hotel-booking-api.postman_collection.json` and `postman/hotel-booking-api.postman_environment.json`, then fill in the environment's `userPassword`, `adminEmail` and `adminPassword` (the admin account must already have `role: "admin"`, see above).

Run the folders in order — **Auth → Hotels → Bookings → Cleanup**:

- **Register / Login** save the user's token to `{{token}}`; **Login as Admin** saves `{{adminToken}}`. Protected requests send `Authorization: Bearer <token>`.
- **Create Hotel** saves `{{hotelId}}` and **Create Booking** saves `{{bookingId}}` for the requests after them.
- Booking dates are computed relative to today by a collection-level pre-request script, so the collection never goes stale.
- Requests whose name ends in `(400)`, `(401)` or `(403)` are deliberate failure cases and assert that status.
- **Register** returns `400` if the email already exists — on later runs, start from **Login**.
