# Hotel Booking API

A REST API backend for a hotel booking system, built with **Node.js + Express** and **MongoDB Atlas (Mongoose)**.
Software Development Practice course project — **Project #1: Hotel Booking**. The assignment brief is in [`docs/`](docs/).

> **Status:** project setup / design phase. Endpoints below are the planned contract; implementation is in progress.

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
| Framework      | Express                                          |
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
│   │   ├── validate.js
│   │   └── errorHandler.js
│   └── utils/
│       ├── ApiError.js
│       └── asyncHandler.js
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
| GET    | `/hotels`      | Public | List hotels       |
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

### Response format

```jsonc
// success
{ "success": true, "data": { ... } }
// success (list)
{ "success": true, "count": 2, "data": [ ... ] }
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

> Commands become available once the project is scaffolded.

```bash
git clone https://github.com/NitipoomPansayor/hotel-booking-api.git
cd hotel-booking-api
npm install
npm run dev               # nodemon, http://localhost:5000
```

### Scripts (planned)

| Command          | Purpose                     |
| ---------------- | --------------------------- |
| `npm run dev`    | Start with nodemon          |
| `npm start`      | Start in production mode    |
| `npm test`       | Run Jest test suite         |
| `npm run lint`   | Lint with ESLint            |

### Creating an admin

Registration always creates `role: "user"`. Promote an account to admin directly in MongoDB Atlas (set `role` to `"admin"`) or via a seed script.

## Testing with Postman

Import `postman/hotel-booking-api.postman_collection.json` and the matching environment. The login request saves the returned token into the `{{token}}` environment variable, which every protected request sends as `Authorization: Bearer {{token}}`.
